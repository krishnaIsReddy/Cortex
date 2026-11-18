// "Summary" panel in the file drill-down: a short, plain-language explanation
// of why the file has its risk score (issue #16). Only requested when the user
// clicks "Summarize", to save the AI service's free quota.
import { useState } from "react";
import "./fileSummary.css";
import { isLiveRepoId, summarizeFile } from "../../services/riskApi.js";

// Why the backend fell back to a plain summary instead of the AI.
const FALLBACK_REASONS = {
  not_configured: "AI summaries aren't set up on this server",
  rate_limited: "the AI service's free limit was reached",
  failed: "the AI service couldn't be reached",
  invalid_output: "the AI's reply couldn't be used",
};

// Fallbacks worth retrying: the next attempt may reach the AI.
const RETRYABLE_REASONS = new Set(["rate_limited", "failed", "invalid_output"]);

// Author labels in summary text: "Author A" to "Author Z". The capturing group
// makes split() keep the labels, so they can be swapped for names.
const LABEL_PATTERN = /(\bAuthor [A-Z]\b)/;

export default function FileSummary({ repoId, path }) {
  // status: "idle" | "loading" | "done" | "error"
  const [state, setState] = useState({ status: "idle", summary: null, error: null });

  const summarize = async () => {
    setState({ status: "loading", summary: null, error: null });
    try {
      const summary = await summarizeFile(repoId, path);
      setState({ status: "done", summary, error: null });
    } catch (err) {
      console.error(`FileSummary: summarizing "${path}" in repo "${repoId}" failed`, err);
      setState({ status: "error", summary: null, error: err });
    }
  };

  let content;
  if (!isLiveRepoId(repoId)) {
    content = (
      <p className="file-detail__caption">
        Summaries are available for analyzed repositories, not sample data.
      </p>
    );
  } else if (state.status === "done") {
    content = <SummaryText summary={state.summary} onRetry={summarize} />;
  } else if (state.status === "error") {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not summarize this file: {state.error.message}</p>
        <button type="button" className="button" onClick={summarize}>
          Retry
        </button>
      </div>
    );
  } else {
    const loading = state.status === "loading";
    content = (
      <div className="file-summary__prompt">
        <div className="file-summary__intro">
          <p className="file-detail__caption">
            Get a plain-language explanation of this file's risk, written by AI from the
            numbers on this page.
          </p>
          {/* Shown before the click, so users know what leaves Cortex. */}
          <p className="file-summary__privacy">
            Only numbers, dates and the file path are sent to Google's Gemini. Author names
            are replaced with labels like "Author A" first, so no names leave Cortex.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={summarize}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? "Summarizing…" : "Summarize"}
        </button>
      </div>
    );
  }

  return (
    <div className="file-detail__section file-summary" aria-live="polite">
      <h3 className="file-detail__heading">Summary</h3>
      {content}
    </div>
  );
}

function SummaryText({ summary, onRetry }) {
  const isAi = summary.source === "ai";

  return (
    <>
      <p className="file-summary__text">
        <TextWithNames text={summary.text} authors={summary.authors} />
      </p>
      <p className="file-detail__caption">
        {isAi
          ? "Written by AI (Gemini) from the numbers on this page. Author names are never sent to the AI."
          : `A basic summary of the numbers on this page, because ${
              FALLBACK_REASONS[summary.reason] ?? "the AI wasn't available"
            }.`}
      </p>
      {!isAi && RETRYABLE_REASONS.has(summary.reason) && (
        <button type="button" className="button file-summary__retry" onClick={onRetry}>
          Try AI again
        </button>
      )}
    </>
  );
}

// The summary with each label ("Author A") replaced by the author's real name,
// in bold italics. The backend only sends summaries whose labels all have a
// name; anything else that looks like a label is shown as written.
function TextWithNames({ text, authors }) {
  const nameByLabel = new Map(authors.map((author) => [author.label, author.name]));

  return text.split(LABEL_PATTERN).map((part, index) =>
    nameByLabel.has(part) ? (
      <span key={index} className="file-summary__name">
        {nameByLabel.get(part)}
      </span>
    ) : (
      part
    )
  );
}
