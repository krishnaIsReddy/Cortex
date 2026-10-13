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

export default function RepoHeader({ repo, fileCount }) {
  return (
    <div className="repo-header">
      <div className="repo-header__name-row">
        <a className="repo-header__name" href={repo.url} target="_blank" rel="noreferrer">
          {repo.name}
        </a>
        {repo.isSample && <span className="repo-header__tag">Sample data</span>}
      </div>

      {/* One line of facts about what was analyzed. */}
      <ul className="repo-header__facts">
        <li>
          Branch <strong>{repo.branch}</strong>
        </li>
        <li>
          Analyzed <time dateTime={repo.analyzedAt}>{formatDateTime(repo.analyzedAt)}</time>
        </li>
        <li>{pluralize(repo.commitCount, "commit")}</li>
        <li>{pluralize(repo.contributorCount, "contributor")}</li>
        <li>{pluralize(fileCount, "file")}</li>
      </ul>
    </div>
  );
}
