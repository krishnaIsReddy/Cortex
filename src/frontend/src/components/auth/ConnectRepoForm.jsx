// "Connect a repository" box: the user pastes a public GitHub URL, the backend
// clones it and reads its commit history, then the dashboard switches to it.
// Signed-out users are asked to sign in first (the backend requires it).
import { useState } from "react";
import "./auth.css";
import { LOGIN_URL } from "../../services/authApi.js";
import { ingestRepo, normalizeRepoUrl } from "../../services/riskApi.js";

// Accepts https://github.com/<owner>/<repo> (after normalizeRepoUrl).
const GITHUB_REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

// Turns a failed ingestion into a message the user can act on.
function describeIngestError(err) {
  if (err.status === 401) return "Your session has expired. Sign in with GitHub again.";
  if (err.status === 500) {
    return "Could not analyze this repository. Check that the URL is correct and the repo is public.";
  }
  return err.message;
}

export default function ConnectRepoForm({ user, onConnected }) {
  const [url, setUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  if (!user) {
    return (
      <p className="connect-repo connect-repo--signed-out">
        <a href={LOGIN_URL}>Sign in with GitHub</a> to analyze a repository.
      </p>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const repoUrl = normalizeRepoUrl(url);

    if (!GITHUB_REPO_URL.test(repoUrl)) {
      setError("Enter a GitHub repository URL, e.g. https://github.com/owner/repo");
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await ingestRepo(repoUrl);
      setUrl("");
      await onConnected(repoUrl);
    } catch (err) {
      console.error(`ConnectRepoForm: ingesting ${repoUrl} failed`, err);
      setError(describeIngestError(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <form className="connect-repo" onSubmit={handleSubmit}>
      <label className="connect-repo__label" htmlFor="repo-url">
        Analyze a public GitHub repository
      </label>
      <div className="connect-repo__row">
        <input
          id="repo-url"
          type="text"
          inputMode="url"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={working}
        />
        <button type="submit" className="button" disabled={working || url.trim() === ""}>
          {working ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {/* Announced to screen readers as the status changes. */}
      <p className="connect-repo__status" aria-live="polite">
        {working && "Cloning the repo and reading its commit history. This can take a minute for large repos."}
      </p>
      {error && (
        <p className="connect-repo__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
