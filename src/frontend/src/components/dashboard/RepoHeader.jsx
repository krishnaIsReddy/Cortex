// Shows which repository the dashboard is analyzing and the scope of the
// analysis (branch, when it ran, how much history was included).
import { pluralize } from "./format.js";

// Formats an ISO timestamp for the viewer's locale, e.g. "Oct 7, 2026, 11:30 AM".
function formatDateTime(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

// `onRemove` is optional: when given, a "Remove" button is shown.
export default function RepoHeader({ repo, fileCount, onRemove }) {
  return (
    <div className="repo-header">
      <div className="repo-header__name-row">
        <a className="repo-header__name" href={repo.url} target="_blank" rel="noreferrer">
          {repo.name}
        </a>
        {repo.isSample && <span className="repo-header__tag">Sample data</span>}
        {onRemove && (
          <button type="button" className="button repo-header__remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {/* One line of facts about what was analyzed. Branch and date are
          skipped when unknown (the backend doesn't record the branch yet). */}
      <ul className="repo-header__facts">
        {repo.branch && (
          <li>
            Branch <strong>{repo.branch}</strong>
          </li>
        )}
        {repo.analyzedAt && (
          <li>
            Analyzed <time dateTime={repo.analyzedAt}>{formatDateTime(repo.analyzedAt)}</time>
          </li>
        )}
        <li>{pluralize(repo.commitCount, "commit")}</li>
        <li>{pluralize(repo.contributorCount, "contributor")}</li>
        <li>{pluralize(fileCount, "file")}</li>
      </ul>
    </div>
  );
}
