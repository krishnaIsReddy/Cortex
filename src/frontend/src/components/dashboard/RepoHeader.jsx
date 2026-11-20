// Shows which repository is open and the scope of the analysis (branch,
// when it ran, how much history was included).
import { pluralize } from "./format.js";
import Icon from "../layout/Icon.jsx";

// Formats an ISO timestamp for the viewer's locale, e.g. "Oct 7, 2026, 11:30 AM".
function formatDateTime(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString));
}

// `onRemove` is optional: when given, a "Remove" button is shown.
export default function RepoHeader({ repo, fileCount, onRemove }) {
  // "tartley/colorama" -> owner "tartley", name "colorama".
  const slash = repo.name.indexOf("/");
  const owner = slash === -1 ? null : repo.name.slice(0, slash);
  const shortName = slash === -1 ? repo.name : repo.name.slice(slash + 1);

  return (
    <div className="repo-header">
      <div className="repo-header__name-row">
        <div className="repo-header__titles">
          {owner && <span className="repo-header__owner">{owner}</span>}
          <h1 className="repo-header__name">{shortName}</h1>
        </div>
        {repo.isSample && <span className="repo-header__tag">Sample data</span>}

        <div className="repo-header__actions">
          {repo.url && (
            <a className="button button--small button--icon" href={repo.url} target="_blank" rel="noreferrer">
              <Icon name="external" size={14} />
              GitHub
            </a>
          )}
          {onRemove && (
            <button type="button" className="button button--small" onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
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
