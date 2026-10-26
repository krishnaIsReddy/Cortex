// Drill-down for one file: its risk, who knows it today versus who wrote it
// originally, how long since it changed, and its recent commits.
// Handles loading and error states like the main dashboard.
import { useEffect, useRef } from "react";
import AuthorBreakdown from "./AuthorBreakdown.jsx";
import RiskBadge from "./RiskBadge.jsx";
import { formatDate, formatPercent, formatRelative, isStale, pluralize } from "./format.js";
import { getRiskLevel, riskClassName } from "./riskLevels.js";
import { useFileDetail } from "../../hooks/useFileDetail.js";

// `repoUrl` is used to link commits to GitHub; `onBack` returns to the table.
export default function FileDetail({ repoId, repoUrl, path, onBack }) {
  const { detail, loading, error, reload } = useFileDetail(repoId, path);

  // Move focus to the heading when the view opens, so keyboard and screen
  // reader users land on the new content instead of the button they clicked.
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  let content;
  if (loading) {
    content = (
      <div className="risk-table-wrapper" aria-busy="true" aria-label="Loading file details">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  } else if (error) {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not load this file: {error.message}</p>
        <button type="button" className="button" onClick={reload}>
          Retry
        </button>
      </div>
    );
  } else {
    content = <FileDetailBody detail={detail} repoUrl={repoUrl} />;
  }

  const level = detail && !loading ? getRiskLevel(detail.riskScore) : null;

  return (
    <section
      className={`file-detail ${level ? riskClassName(level) : ""}`}
      aria-labelledby="file-detail-title"
    >
      <button type="button" className="file-detail__back" onClick={onBack}>
        ← All files
      </button>

      <div className="file-detail__title-row">
        <h2 id="file-detail-title" className="file-detail__title" tabIndex={-1} ref={headingRef}>
          {path}
        </h2>
        {level && <RiskBadge level={level} />}
      </div>

      {content}
    </section>
  );
}

function FileDetailBody({ detail, repoUrl }) {
  const stale = isStale(detail.lastChangedAt);
  const originalAuthor = [...detail.authors].sort(
    (a, b) => b.historicalShare - a.historicalShare
  )[0];
  const ownershipShifted = originalAuthor.name !== detail.topAuthor;

  return (
    <>
      <ul className="repo-header__facts">
        <li>
          Score <strong>{detail.riskScore.toFixed(2)}</strong>
        </li>
        <li>
          Top author <strong>{detail.topAuthor}</strong> ({formatPercent(detail.topAuthorShare)})
        </li>
        <li>
          Last changed{" "}
          <time dateTime={detail.lastChangedAt}>{formatDate(detail.lastChangedAt)}</time> (
          {formatRelative(detail.lastChangedAt)})
          {stale && <span className="stale-tag">Stale</span>}
        </li>
        {detail.commitCount !== null && <li>{pluralize(detail.commitCount, "commit")}</li>}
      </ul>

      {/* Call out the case decay exists for: the original author has moved on. */}
      {ownershipShifted && (
        <p className="file-detail__note">
          {originalAuthor.name} wrote the most of this file overall (
          {formatPercent(originalAuthor.historicalShare)} all-time), but {detail.topAuthor} has
          done most of the recent work, so {detail.topAuthor} is the best person to ask.
        </p>
      )}
      {stale && (
        <p className="file-detail__note">
          Nobody has changed this file in over a year. Even its top author may no longer
          remember how it works.
        </p>
      )}

      <div className="file-detail__section">
        <h3 className="file-detail__heading">Authors</h3>
        <p className="file-detail__caption">
          Current share weights each commit by its age: a commit {detail.halfLifeDays} days
          older than the newest counts half as much. The risk score uses the current share.
        </p>
        <AuthorBreakdown authors={detail.authors} />
      </div>

      <div className="file-detail__section">
        <h3 className="file-detail__heading">Recent commits</h3>
        <CommitList detail={detail} repoUrl={repoUrl} />
      </div>
    </>
  );
}

function CommitList({ detail, repoUrl }) {
  if (detail.commitCount === null) {
    return <p className="state-message">Sample data has no commit history.</p>;
  }

  const { commits, commitCount } = detail;

  return (
    <>
      {commits.length < commitCount && (
        <p className="file-detail__caption">
          Showing the {commits.length} most recent of {pluralize(commitCount, "commit")}.
        </p>
      )}
      <div className="risk-table-wrapper">
        <table className="risk-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Author</th>
              <th scope="col">Message</th>
              <th scope="col" className="col-number">Lines</th>
              <th scope="col">Commit</th>
            </tr>
          </thead>
          <tbody>
            {commits.map((commit) => (
              <tr key={commit.sha}>
                <td className="col-nowrap">
                  <time dateTime={commit.committedAt}>{formatDate(commit.committedAt)}</time>
                </td>
                <td className="col-nowrap">{commit.authorName}</td>
                <td className="commit-summary">{commit.summary}</td>
                <td className="col-number">
                  <span className="lines-added">+{commit.linesAdded}</span>{" "}
                  <span className="lines-removed">−{commit.linesRemoved}</span>
                </td>
                <td className="commit-sha">
                  <a href={`${repoUrl}/commit/${commit.sha}`} target="_blank" rel="noreferrer">
                    {commit.sha.slice(0, 7)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
