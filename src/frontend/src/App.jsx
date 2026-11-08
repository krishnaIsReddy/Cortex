// Root component: the app header (repo picker + sign-in), the "connect a
// repository" box, and the dashboard for the chosen repo (a live repo from the
// backend, or a sample dataset).
import { useState } from "react";
import ConnectRepoForm from "./components/auth/ConnectRepoForm.jsx";
import UserBadge from "./components/auth/UserBadge.jsx";
import Dashboard from "./components/dashboard/Dashboard.jsx";
import RepoPicker from "./components/dashboard/RepoPicker.jsx";
import { useCurrentUser } from "./hooks/useCurrentUser.js";
import { useLiveRepos } from "./hooks/useLiveRepos.js";
import { isLiveRepoId, removeRepo } from "./services/riskApi.js";

// Shown when the backend has no ingested repos (or isn't running).
const FALLBACK_REPO_ID = "cortex";

export default function App() {
  const { user, loading: userLoading, signOut } = useCurrentUser();
  const {
    repos: liveRepos,
    loading: liveLoading,
    error: liveError,
    reload: reloadLiveRepos,
  } = useLiveRepos();

  // The repo the user picked, or null if they haven't picked one yet.
  const [selectedRepoId, setSelectedRepoId] = useState(null);

  // Bumped after every ingestion so the dashboard reloads, even when the
  // re-analyzed repo is the one already on screen.
  const [analysisCount, setAnalysisCount] = useState(0);

  // Until the user picks, show the newest live repo, or the fallback sample.
  // While the live list is still loading, wait instead of flashing the sample.
  const repoId =
    selectedRepoId ?? (liveLoading ? null : liveRepos[0]?.id ?? FALLBACK_REPO_ID);

  // After a repo is ingested: refresh the picker's list and switch to that repo.
  const handleRepoConnected = async (repoUrl) => {
    const repos = await reloadLiveRepos();
    const connected = repos.find((repo) => repo.url === repoUrl);
    if (connected) {
      setSelectedRepoId(connected.id);
    } else {
      console.warn(`App: ingested ${repoUrl} but it isn't in the repo list`);
    }
    setAnalysisCount((count) => count + 1);
  };

  // Deletes the live repo on screen (after confirming), then shows the next one.
  const handleRemoveRepo = async () => {
    const repo = liveRepos.find((r) => r.id === repoId);
    if (!window.confirm(`Remove ${repo?.name ?? "this repo"} and its analysis from Cortex?`)) return;

    try {
      await removeRepo(repoId);
      await reloadLiveRepos();
      setSelectedRepoId(null); // falls back to the newest remaining live repo
    } catch (err) {
      console.error(`App: removing repo ${repoId} failed`, err);
      window.alert(`Could not remove the repo: ${err.message}`);
    }
  };

  // Only live repos can be removed, and only by a signed-in user.
  const canRemove = Boolean(user) && repoId !== null && isLiveRepoId(repoId);

  return (
    <main className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">Cortex</h1>
          <p className="app__tagline">Codebase ownership &amp; bus-factor risk</p>
        </div>
        <div className="app__controls">
          <RepoPicker
            value={repoId ?? ""}
            onChange={setSelectedRepoId}
            liveRepos={liveRepos}
            liveLoading={liveLoading}
            liveError={liveError}
          />
          <UserBadge user={user} loading={userLoading} onSignOut={signOut} />
        </div>
      </header>

      {!userLoading && <ConnectRepoForm user={user} onConnected={handleRepoConnected} />}

      {/* A new key gives the Dashboard a fresh start (filters and expanded row
          reset, data reloads) when switching repos or after re-analyzing. */}
      {repoId && (
        <Dashboard
          key={`${repoId}-${analysisCount}`}
          repoId={repoId}
          onRemoveRepo={canRemove ? handleRemoveRepo : undefined}
        />
      )}
    </main>
  );
}
