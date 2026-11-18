"""Plain-language explanation of why a file is flagged (issue #16).

Gemini writes the explanation from numbers that scoring already computed. It
never sees source code and never computes the score: it only puts the numbers
into words, as the proposal requires.

Privacy: on Gemini's free tier, prompts may be used to improve Google's models
and read by human reviewers, and the terms say not to send personal
information. So author names never leave the server: they're replaced with
labels ("Author A", "Author B", ...) before the call. The summary keeps the
labels, and comes with the name each label stands for, so the dashboard can
show (and style) the names. Emails and commit messages aren't sent either;
only numbers, dates, and the file path (repos are public).

If Gemini isn't configured or the call fails, a plain template summary of the
same numbers is returned instead, so the dashboard always has something.
"""

import asyncio
import datetime
import logging
import re
from collections import OrderedDict
from dataclasses import dataclass
from functools import cache
from typing import Awaitable, Callable, Hashable

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai.interactions import Interaction

from src.services.scoring.ownership import FileOwnership

logger = logging.getLogger(__name__)

# Same cutoffs as the dashboard's levels (src/frontend/src/components/dashboard/riskLevels.js).
RISK_LEVELS = [("high", 0.7), ("medium", 0.4), ("low", 0.0)]

# Only the top authors are described individually; the rest are counted.
MAX_AUTHORS_IN_PROMPT = 5

# Summaries are 2-3 sentences; anything far longer means the model ignored
# the instructions, so the template is used instead.
MAX_SUMMARY_CHARS = 800

# Generous, since some models count thinking towards this limit.
MAX_OUTPUT_TOKENS = 1024
TIMEOUT_SECONDS = 20

# Summaries kept in memory, so re-opening a file doesn't use the free quota again.
MAX_CACHED_SUMMARIES = 500

SYSTEM_INSTRUCTION = """\
You explain bus-factor risk for one file in a software repository to engineers \
and managers. Bus-factor risk means knowledge of the file is concentrated in \
too few people. You are given numbers that were already computed. In 2 or 3 \
short sentences of plain English, explain why the file has its risk level and \
what that means for the team.

Rules:
- Use only the facts given. Don't guess what the code does.
- Refer to people only by their labels, exactly as written (for example \
"Author A"). Never invent names.
- Plain text only: no markdown, bullet points, or headings."""

# How labels appear in the prompt and the summary: "Author A" to "Author Z".
LABEL_PATTERN = re.compile(r"\bAuthor [A-Z]\b")

# (system instruction, prompt) -> reply text
Generate = Callable[[str, str], Awaitable[str]]


@dataclass(frozen=True)
class SummaryAuthor:
    label: str  # e.g. "Author A"
    name: str  # the author's real name, never sent to Gemini


@dataclass(frozen=True)
class FileSummary:
    text: str  # refers to authors by label, e.g. "Author A wrote 92%..."
    authors: tuple[SummaryAuthor, ...]  # the name behind every label in `text`
    source: str  # "ai", or "template" when Gemini wasn't used
    # Why the template was used: "not_configured", "rate_limited", "failed",
    # or "invalid_output". None for AI summaries.
    reason: str | None = None


class InvalidSummary(Exception):
    """The model's reply can't be shown (empty, too long, or unknown labels)."""


_cache: OrderedDict[Hashable, FileSummary] = OrderedDict()


def risk_level(score: float) -> str:
    """"high", "medium" or "low", e.g. 0.85 -> "high"."""
    return next(name for name, minimum in RISK_LEVELS if score >= minimum)


def time_ago(moment: datetime.datetime, today: datetime.date) -> str:
    """Rough age in words, e.g. "today", "5 days ago", "8 months ago", "2 years ago"."""
    days = max((today - moment.date()).days, 0)
    if days == 0:
        return "today"
    if days < 60:
        return f"{days} day{'s' if days != 1 else ''} ago"
    if days < 730:
        return f"{days // 30} months ago"
    return f"{days // 365} years ago"


def author_labels(file: FileOwnership) -> dict[str, str]:
    """Real name -> label ("Author A", ...) for the authors described in the
    prompt, largest current share first."""
    top_authors = file.authors[:MAX_AUTHORS_IN_PROMPT]
    return {author.name: f"Author {chr(ord('A') + i)}" for i, author in enumerate(top_authors)}


def build_prompt(
    file: FileOwnership, commit_count: int, labels: dict[str, str], today: datetime.date
) -> str:
    """The facts sent to the model. Contains labels, never names."""
    lines = [
        f"File: {file.path}",
        f"Risk score: {file.risk_score:.2f} ({risk_level(file.risk_score)}). "
        "Levels: high is 0.70 or more, medium 0.40 to 0.69, low below 0.40. "
        "The score is the top author's current share of the file.",
        f"Commits to this file: {commit_count}",
        f"Last changed: {time_ago(file.last_changed_at, today)}",
        "Authors (current share weights recent commits more; all-time share counts every line equally):",
    ]
    for author in file.authors[:MAX_AUTHORS_IN_PROMPT]:
        lines.append(
            f"- {labels[author.name]}: current share {author.share:.0%}, "
            f"all-time share {author.historical_share:.0%}, "
            f"{author.commit_count} commits, last commit {time_ago(author.last_commit_at, today)}"
        )
    others = len(file.authors) - MAX_AUTHORS_IN_PROMPT
    if others > 0:
        lines.append(f"- {others} other authors with smaller shares")
    return "\n".join(lines)


def check_summary(text: str, labels: dict[str, str]) -> str:
    """Return the model's reply, trimmed. Raises InvalidSummary if it's empty,
    too long, or uses a label that wasn't in the prompt (so every label in a
    summary has a name)."""
    text = text.strip()
    if not text or len(text) > MAX_SUMMARY_CHARS:
        raise InvalidSummary(f"reply length {len(text)}")

    unknown = set(LABEL_PATTERN.findall(text)) - set(labels.values())
    if unknown:
        raise InvalidSummary(f"unknown labels {sorted(unknown)}")
    return text


def template_summary(
    file: FileOwnership, commit_count: int, labels: dict[str, str], today: datetime.date
) -> str:
    """A plain summary of the same numbers, used when Gemini isn't available.
    Uses labels like the AI summaries, so both are shown the same way."""
    level = risk_level(file.risk_score)
    top = labels[file.top_author]
    if len(file.authors) == 1:
        first = f"{top} is the only author of this file, so its risk is {level}."
    else:
        first = (
            f"{top} has written {file.top_author_share:.0%} of this file "
            f"(weighting recent work more), so its risk is {level}."
        )
    commits = f"{commit_count} commit{'s' if commit_count != 1 else ''}"
    return f"{first} It has {commits} and was last changed {time_ago(file.last_changed_at, today)}."


@cache
def _gemini_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def gemini_generator(api_key: str, model: str) -> Generate:
    """A Generate function that calls Gemini's Interactions API."""

    async def generate(system_instruction: str, prompt: str) -> str:
        interaction = await _gemini_client(api_key).aio.interactions.create(
            model=model,
            input=prompt,
            system_instruction=system_instruction,
            generation_config={"max_output_tokens": MAX_OUTPUT_TOKENS},
            store=False,  # don't keep the interaction on Google's side
            timeout=TIMEOUT_SECONDS,
        )
        # create() can also return a stream, but only when stream=True is passed.
        if not isinstance(interaction, Interaction):
            raise InvalidSummary("expected a single reply, got a stream")
        if interaction.status != "completed":
            raise InvalidSummary(f"interaction status {interaction.status!r}")
        return interaction.output_text or ""

    return generate


async def summarize_file(
    file: FileOwnership,
    commit_count: int,
    generate: Generate | None,
    cache_key: Hashable | None = None,
    today: datetime.date | None = None,
) -> FileSummary:
    """Explain the file's risk in 2-3 sentences.

    `generate` calls the model (None when no API key is set). AI summaries are
    cached under `cache_key`; template summaries aren't, so a later request
    can try the model again.
    """
    if cache_key is not None and cache_key in _cache:
        _cache.move_to_end(cache_key)
        return _cache[cache_key]

    today = today or datetime.datetime.now(datetime.timezone.utc).date()
    labels = author_labels(file)
    authors = tuple(SummaryAuthor(label=label, name=name) for name, label in labels.items())

    def fallback(reason: str) -> FileSummary:
        text = template_summary(file, commit_count, labels, today)
        return FileSummary(text, authors, "template", reason)

    if generate is None:
        return fallback("not_configured")

    try:
        reply = await generate(SYSTEM_INSTRUCTION, build_prompt(file, commit_count, labels, today))
        text = check_summary(reply, labels)
    except genai_errors.ClientError as err:
        logger.warning("Gemini request failed: %s", err)
        return fallback("rate_limited" if err.code == 429 else "failed")
    except (genai_errors.APIError, httpx.HTTPError, asyncio.TimeoutError) as err:
        logger.warning("Gemini request failed: %s", err)
        return fallback("failed")
    except InvalidSummary as err:
        logger.warning("Gemini reply not usable: %s", err)
        return fallback("invalid_output")

    summary = FileSummary(text, authors, "ai")
    if cache_key is not None:
        _cache[cache_key] = summary
        if len(_cache) > MAX_CACHED_SUMMARIES:
            _cache.popitem(last=False)  # drop the least recently used
    return summary
