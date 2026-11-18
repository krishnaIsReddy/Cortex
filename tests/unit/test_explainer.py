import asyncio
import datetime

import httpx
from google.genai import errors as genai_errors

from src.ai import explainer
from src.ai.explainer import (
    InvalidSummary,
    SummaryAuthor,
    author_labels,
    build_prompt,
    check_summary,
    summarize_file,
    template_summary,
)
from src.services.scoring.ownership import AuthorShare, FileOwnership

TODAY = datetime.date(2026, 11, 17)


def at(days_ago):
    return datetime.datetime(2026, 11, 17, 12, tzinfo=datetime.timezone.utc) - datetime.timedelta(days=days_ago)


def file_with(*authors, path="src/api/auth.py"):
    """authors: (name, share, historical_share, commit_count, days since last commit)."""
    shares = [
        AuthorShare(name, share, historical, commits, at(days))
        for name, share, historical, commits, days in authors
    ]
    top = shares[0]
    return FileOwnership(
        path=path,
        risk_score=top.share,
        top_author=top.name,
        top_author_share=top.share,
        last_changed_at=max(a.last_commit_at for a in shares),
        authors=shares,
    )


ANA_AND_BEN = file_with(("Ana Silva", 0.92, 0.6, 20, 240), ("Ben Okafor", 0.08, 0.4, 6, 900))
ANA_AND_BEN_LABELS = (SummaryAuthor("Author A", "Ana Silva"), SummaryAuthor("Author B", "Ben Okafor"))


def run(coro):
    return asyncio.run(coro)


def replying(text, calls=None):
    """A fake Gemini that returns `text` and records each prompt in `calls`."""
    async def generate(system_instruction, prompt):
        if calls is not None:
            calls.append(prompt)
        return text
    return generate


def failing(error):
    async def generate(system_instruction, prompt):
        raise error
    return generate


def setup_function():
    explainer._cache.clear()


def test_prompt_uses_labels_and_never_names():
    labels = author_labels(ANA_AND_BEN)
    prompt = build_prompt(ANA_AND_BEN, 26, labels, TODAY)

    assert labels == {"Ana Silva": "Author A", "Ben Okafor": "Author B"}
    assert "Ana" not in prompt and "Ben" not in prompt and "Silva" not in prompt
    assert "- Author A: current share 92%, all-time share 60%, 20 commits, last commit 8 months ago" in prompt
    assert "Risk score: 0.92 (high)" in prompt
    assert "Last changed: 8 months ago" in prompt


def test_prompt_describes_only_the_top_authors():
    many = file_with(*[(f"Dev {i}", 0.3 - i * 0.02, 0.1, 1, 10) for i in range(8)])

    prompt = build_prompt(many, 8, author_labels(many), TODAY)

    assert "Author E" in prompt and "Author F" not in prompt
    assert "- 3 other authors with smaller shares" in prompt


def test_ai_summary_keeps_labels_and_says_who_they_are():
    calls = []
    reply = "  Author A wrote 92% of this file. Author B hasn't touched it in years.\n"

    summary = run(summarize_file(ANA_AND_BEN, 26, replying(reply, calls), today=TODAY))

    assert summary.source == "ai" and summary.reason is None
    assert summary.text == "Author A wrote 92% of this file. Author B hasn't touched it in years."
    assert summary.authors == ANA_AND_BEN_LABELS
    assert "Ana" not in calls[0]


def test_unknown_label_in_reply_falls_back_to_the_template():
    summary = run(summarize_file(ANA_AND_BEN, 26, replying("Author C knows this file."), today=TODAY))

    assert (summary.source, summary.reason) == ("template", "invalid_output")


def test_empty_or_long_reply_falls_back_to_the_template():
    for reply in ["   ", "x" * 2000]:
        summary = run(summarize_file(ANA_AND_BEN, 26, replying(reply), today=TODAY))
        assert (summary.source, summary.reason) == ("template", "invalid_output")


def test_no_api_key_uses_the_template():
    summary = run(summarize_file(ANA_AND_BEN, 26, None, today=TODAY))

    assert (summary.source, summary.reason) == ("template", "not_configured")
    assert summary.text == (
        "Author A has written 92% of this file (weighting recent work more), so its risk is "
        "high. It has 26 commits and was last changed 8 months ago."
    )
    assert summary.authors == ANA_AND_BEN_LABELS


def test_rate_limit_and_network_errors_use_the_template():
    rate_limited = genai_errors.ClientError(429, {"error": {"status": "RESOURCE_EXHAUSTED"}})
    bad_request = genai_errors.ClientError(400, {"error": {"status": "INVALID_ARGUMENT"}})
    server_error = genai_errors.ServerError(503, {"error": {"status": "UNAVAILABLE"}})

    cases = [
        (rate_limited, "rate_limited"),
        (bad_request, "failed"),
        (server_error, "failed"),
        (httpx.ConnectError("no network"), "failed"),
        (asyncio.TimeoutError(), "failed"),
    ]
    for error, reason in cases:
        summary = run(summarize_file(ANA_AND_BEN, 26, failing(error), today=TODAY))
        assert (summary.source, summary.reason) == ("template", reason), error


def test_ai_summaries_are_cached_but_templates_are_not():
    calls = []
    key = ("repo", "src/api/auth.py", "synced-at", "model")

    run(summarize_file(ANA_AND_BEN, 26, replying("Author A owns it.", calls), cache_key=key, today=TODAY))
    again = run(summarize_file(ANA_AND_BEN, 26, replying("Author A owns it.", calls), cache_key=key, today=TODAY))
    assert len(calls) == 1 and again.text == "Author A owns it."

    other_key = ("repo", "src/other.py", "synced-at", "model")
    run(summarize_file(ANA_AND_BEN, 26, failing(httpx.ConnectError("down")), cache_key=other_key, today=TODAY))
    retried = run(summarize_file(ANA_AND_BEN, 26, replying("Author A owns it.", calls), cache_key=other_key, today=TODAY))
    assert retried.source == "ai"


def test_single_author_template():
    solo = file_with(("Ana Silva", 1.0, 1.0, 3, 0))

    assert template_summary(solo, 3, author_labels(solo), TODAY) == (
        "Author A is the only author of this file, so its risk is high. "
        "It has 3 commits and was last changed today."
    )


def test_check_summary_only_looks_at_whole_labels():
    labels = {"Ana Silva": "Author A"}

    assert check_summary("  Author A's file; Authority is shared.  ", labels) == (
        "Author A's file; Authority is shared."
    )
    try:
        check_summary("Author A and Author Q", labels)
    except InvalidSummary as err:
        assert "Author Q" in str(err)
    else:
        raise AssertionError("an unknown label should be rejected")
