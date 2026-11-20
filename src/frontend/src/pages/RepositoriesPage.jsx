// Repositories page: analyze a new repo, and every repo Cortex knows about
// (analyzed repos from the backend, plus the built-in sample datasets).
import { Link } from "react-router";
import "../components/dashboard/dashboard.css";
import "../components/layout/layout.css";
import ConnectRepoForm from "../components/auth/ConnectRepoForm.jsx";
import { formatRelative } from "../components/dashboard/format.js";
import Icon from "../components/layout/Icon.jsx";
import TabSkeleton from "../components/layout/TabSkeleton.jsx";
import { repoPath } from "../routes.js";
import { sampleRepoOptions } from "../services/mockData/index.js";

export default function RepositoriesPage({
  user,
  userLoading,
  liveRepos,
  liveLoading,
  liveError,
  onConnected,
  onRemove,
  canRemove,
}) {
  let liveContent;
  if (liveLoading) {
    liveContent = <TabSkeleton label="Loading repositories" rows={3} />;
  } else if (liveError) {
    liveContent = (
      <p className="state-message state-message--error" role="alert">
        Could not reach the Cortex API, so analyzed repositories can't be listed.
        The sample data below still works.
      </p>
    );
  } else if (liveRepos.length === 0) {
    liveContent = (
      <p className="state-message">
        No repositories analyzed yet. Paste a public GitHub URL above to analyze one.
      </p>
    );
  } else {
    liveContent = (
      <ul className="repo-cards">
        {liveRepos.map((repo) => (
          <RepoCard
            key={repo.id}
            name={repo.name}
            to={repoPath(repo.id)}
            detail={
              repo.analyzedAt ? (
                <>
                  Analyzed <time dateTime={repo.analyzedAt}>{formatRelative(repo.analyzedAt)}</time>
                </>
              ) : (
                "Not analyzed yet"
              )
            }
          >
            <a href={repo.url} target="_blank" rel="noreferrer" className="button button--small button--icon">
              <Icon name="external" size={14} />
              GitHub
            </a>
            {canRemove(repo.id) && (
              <button type="button" className="button button--small" onClick={() => onRemove(repo.id)}>
                Remove
              </button>
            )}
          </RepoCard>
        ))}
      </ul>
    );
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Repositories</h1>
        <p className="page__subtitle">
          Analyze a GitHub repository to see where knowledge is concentrated in too
          few people.
        </p>
      </header>

      {!userLoading && <ConnectRepoForm user={user} onConnected={onConnected} />}

      <section className="page__section" aria-labelledby="analyzed-title">
        <h2 id="analyzed-title" className="dashboard__title">Analyzed</h2>
        {liveContent}
      </section>

      <section className="page__section" aria-labelledby="samples-title">
        <h2 id="samples-title" className="dashboard__title">Sample data</h2>
        <p className="dashboard__subtitle">
          Made-up datasets that show each state of the dashboard without a backend.
        </p>
        <ul className="repo-cards repo-cards--compact">
          {sampleRepoOptions.map((sample) => (
            <RepoCard key={sample.id} name={sample.label} to={repoPath(sample.id)} detail="Sample data" />
          ))}
        </ul>
      </section>
    </div>
  );
}

// One repository as a card: its owner and name (the link), a detail line,
// and any action buttons passed as children. The whole card is clickable.
function RepoCard({ name, to, detail, children }) {
  const slash = name.indexOf("/");
  const owner = slash === -1 ? null : name.slice(0, slash);
  const shortName = slash === -1 ? name : name.slice(slash + 1);
  return (
    <li className="repo-card">
      <div className="repo-header__titles">
        {owner && <span className="repo-header__owner">{owner}</span>}
        <Link to={to} className="repo-card__name">
          {shortName}
        </Link>
      </div>
      <p className="repo-card__detail">{detail}</p>
      {children && <div className="repo-card__actions">{children}</div>}
    </li>
  );
}
