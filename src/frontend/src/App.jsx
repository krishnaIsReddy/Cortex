// Root component: the sidebar, plus one route per page (see routes.js).
// Owns the app-wide data every page shares: the signed-in user and the list
// of analyzed repos, and the actions that change that list (analyze, remove).
import { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";
import Sidebar from "./components/layout/Sidebar.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RepositoriesPage from "./pages/RepositoriesPage.jsx";
import ScoringPage from "./pages/ScoringPage.jsx";
import CouplingTab from "./pages/repo/CouplingTab.jsx";
import FilesTab from "./pages/repo/FilesTab.jsx";
import FileTab from "./pages/repo/FileTab.jsx";
import FoldersTab from "./pages/repo/FoldersTab.jsx";
import HistoryTab from "./pages/repo/HistoryTab.jsx";
import OverviewTab from "./pages/repo/OverviewTab.jsx";
import PeopleTab from "./pages/repo/PeopleTab.jsx";
import PersonTab from "./pages/repo/PersonTab.jsx";
import RepoRoute from "./pages/repo/RepoLayout.jsx";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { useLiveRepos } from "./hooks/useLiveRepos.js";
import { REPOSITORIES_PATH, SCORING_PATH, repoPath } from "./routes.js";
import { isLiveRepoId, removeRepo } from "./services/riskApi.js";

// Shown when the backend has no ingested repos (or isn't running).
const FALLBACK_REPO_ID = "cortex";

export default function App() {
  const navigate = useNavigate();
  const { user, loading: userLoading, signOut } = useCurrentUser();
  const {
    repos: liveRepos,
    loading: liveLoading,
    error: liveError,
    reload: reloadLiveRepos,
  } = useLiveRepos();

  // Bumped after every ingestion so the repo's pages reload, even when the
  // re-analyzed repo is the one already on screen.
  const [analysisCount, setAnalysisCount] = useState(0);

  // The open repo's counts for the sidebar, sent up by its RepoLayout.
  const [repoSummary, setRepoSummary] = useState(null);

  // After a repo is ingested: refresh the repo list and open its Overview.
  const handleRepoConnected = async (repoUrl) => {
    const repos = await reloadLiveRepos();
    const connected = repos.find((repo) => repo.url === repoUrl);
    setAnalysisCount((count) => count + 1);
    if (connected) {
      navigate(repoPath(connected.id));
    } else {
      console.warn(`App: ingested ${repoUrl} but it isn't in the repo list`);
    }
  };

  // Deletes a live repo (after confirming), then shows the repository list.
  const handleRemoveRepo = async (repoId) => {
    const repo = liveRepos.find((r) => r.id === repoId);
    if (!window.confirm(`Remove ${repo?.name ?? "this repo"} and its analysis from Cortex?`)) return;

    try {
      await removeRepo(repoId);
      await reloadLiveRepos();
      navigate(REPOSITORIES_PATH);
    } catch (err) {
      console.error(`App: removing repo ${repoId} failed`, err);
      window.alert(`Could not remove the repo: ${err.message}`);
    }
  };

  // Only live repos can be removed, and only by a signed-in user.
  const canRemove = (repoId) => Boolean(user) && isLiveRepoId(repoId);

  return (
    <div className="app">
      <Sidebar
        user={user}
        userLoading={userLoading}
        onSignOut={signOut}
        liveRepos={liveRepos}
        liveLoading={liveLoading}
        liveError={liveError}
        summary={repoSummary}
      />

      <main className="app__main">
        <Routes>
          {/* Until the user picks, open the newest live repo, or the fallback
              sample. While the list loads, wait instead of flashing the sample. */}
          <Route
            path="/"
            element={
              liveLoading ? null : (
                <Navigate to={repoPath(liveRepos[0]?.id ?? FALLBACK_REPO_ID)} replace />
              )
            }
          />
          <Route
            path={REPOSITORIES_PATH}
            element={
              <RepositoriesPage
                user={user}
                userLoading={userLoading}
                liveRepos={liveRepos}
                liveLoading={liveLoading}
                liveError={liveError}
                onConnected={handleRepoConnected}
                onRemove={handleRemoveRepo}
                canRemove={canRemove}
              />
            }
          />
          <Route path={SCORING_PATH} element={<ScoringPage />} />

          <Route
            path="/repos/:repoId"
            element={
              <RepoRoute
                analysisCount={analysisCount}
                onRemove={handleRemoveRepo}
                canRemove={canRemove}
                onSummary={setRepoSummary}
              />
            }
          >
            <Route index element={<OverviewTab />} />
            <Route path="files" element={<FilesTab />} />
            <Route path="files/*" element={<FileTab />} />
            <Route path="folders" element={<FoldersTab />} />
            <Route path="people" element={<PeopleTab />} />
            <Route path="people/:name" element={<PersonTab />} />
            <Route path="coupling" element={<CouplingTab />} />
            <Route path="history" element={<HistoryTab />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
