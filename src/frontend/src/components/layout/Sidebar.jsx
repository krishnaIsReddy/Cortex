// App-wide sidebar: the Cortex name (home link), the repo switcher, the open
// repo's sections, the app-level pages, and sign-in. On narrow screens it
// becomes a header with the sections in a row that scrolls sideways.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useMatch, useNavigate } from "react-router";
import "./layout.css";
import Icon from "./Icon.jsx";
import UserBadge from "../auth/UserBadge.jsx";
import RepoSwitcher from "./RepoSwitcher.jsx";
import { sampleRepoOptions } from "../../services/mockData/index.js";
import { REPOSITORIES_PATH, REPO_TABS, SCORING_PATH, repoPath } from "../../routes.js";

// The section the user is on ("" = Overview), so switching repos keeps it.
// Deeper pages (one file or person) fall back to their section, since that
// file or person may not exist in the other repo.
function currentTab(pathname) {
  const segment = pathname.split("/")[3] ?? "";
  return REPO_TABS.some((tab) => tab.segment === segment) ? segment : "";
}

// The last repo the user had open, kept for this browser tab so the
// sidebar still shows it after a page reload on Repositories or Scoring.
// Storage can be unavailable (private mode, blocked site data); then it's
// simply not remembered across reloads.
const LAST_REPO_KEY = "cortex:lastRepoId";

function readLastRepo() {
  try {
    return sessionStorage.getItem(LAST_REPO_KEY);
  } catch {
    return null;
  }
}

function saveLastRepo(repoId) {
  try {
    sessionStorage.setItem(LAST_REPO_KEY, repoId);
  } catch {
    // Not remembered across reloads; the in-memory copy still works.
  }
}

// `summary` is the open repo's counts ({ repoId, files, folders, people,
// highRisk }), sent up by RepoLayout once its report loads; null until then.
export default function Sidebar({
  user,
  userLoading,
  onSignOut,
  liveRepos,
  liveLoading,
  liveError,
  summary,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The repo in the URL, or undefined on app-level pages like Repositories.
  const urlRepoId = useMatch("/repos/:repoId/*")?.params.repoId;

  // On app-level pages the sidebar keeps showing the last open repo, so its
  // sections stay one click away instead of disappearing.
  const [lastRepoId, setLastRepoId] = useState(readLastRepo);
  useEffect(() => {
    if (!urlRepoId) return;
    setLastRepoId(urlRepoId);
    saveLastRepo(urlRepoId);
  }, [urlRepoId]);

  // Forget a remembered repo that no longer exists (e.g. it was removed).
  const rememberedExists =
    liveLoading ||
    liveRepos.some((repo) => repo.id === lastRepoId) ||
    sampleRepoOptions.some((sample) => sample.id === lastRepoId);
  const repoId = urlRepoId ?? (lastRepoId && rememberedExists ? lastRepoId : undefined);
  const counts = summary && summary.repoId === repoId ? summary : null;

  const switchRepo = (newRepoId) => navigate(repoPath(newRepoId, currentTab(pathname)));

  return (
    <aside className="sidebar">
      {/* The aside fills the page height (so its background does); the inner
          column sticks to the viewport while the page scrolls. */}
      <div className="sidebar__inner">
      <div className="sidebar__head">
        <Link to={repoId ? repoPath(repoId) : "/"} className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">C</span>
          <span className="sidebar__brand-text">
            <span className="sidebar__name">Cortex</span>
            <span className="sidebar__tagline">Bus-factor risk</span>
          </span>
        </Link>
        <div className="sidebar__user sidebar__user--top">
          <UserBadge user={user} loading={userLoading} onSignOut={onSignOut} />
        </div>
      </div>

      <div className="sidebar__picker">
        <RepoSwitcher
          value={repoId ?? ""}
          onChange={switchRepo}
          liveRepos={liveRepos}
          liveLoading={liveLoading}
          liveError={liveError}
        />
      </div>

      <div className="sidebar__navs">
        {repoId && (
          <nav className="sidebar__section" aria-label="Repository">
            <p className="sidebar__heading">Repository</p>
            <ul className="sidebar__list">
              {REPO_TABS.map((tab) => (
                <li key={tab.segment}>
                  <NavLink
                    to={repoPath(repoId, tab.segment)}
                    // Overview is the repo's own URL; `end` keeps it from also
                    // matching every section underneath it.
                    end={tab.segment === ""}
                    className="sidebar__link"
                  >
                    <Icon name={tab.icon} />
                    <span className="sidebar__label">{tab.label}</span>
                    <SectionCount tab={tab} counts={counts} />
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav className="sidebar__section" aria-label="Workspace">
          <p className="sidebar__heading">Workspace</p>
          <ul className="sidebar__list">
            <li>
              <NavLink to={REPOSITORIES_PATH} className="sidebar__link">
                <Icon name="repos" />
                <span className="sidebar__label">Repositories</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={SCORING_PATH} className="sidebar__link">
                <Icon name="book" />
                <span className="sidebar__label">How scoring works</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>

      <div className="sidebar__user sidebar__user--bottom">
        <UserBadge user={user} loading={userLoading} onSignOut={onSignOut} />
      </div>
      </div>
    </aside>
  );
}

// The number beside a section: file/folder/people counts, and on Overview
// how many files are High risk (the one count that takes a risk color).
function SectionCount({ tab, counts }) {
  if (!counts) return null;
  if (tab.segment === "" && counts.highRisk > 0) {
    return (
      <span className="sidebar__count risk--high" title={`${counts.highRisk} high-risk files`}>
        {counts.highRisk}
        <span className="visually-hidden"> high-risk files</span>
      </span>
    );
  }
  const value = counts[tab.segment];
  if (value === undefined) return null;
  return <span className="sidebar__count">{value}</span>;
}
