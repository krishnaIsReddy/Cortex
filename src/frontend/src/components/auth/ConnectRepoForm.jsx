// "Connect a repository" box: the user pastes a public GitHub URL, the backend
// clones it and reads its commit history, then the dashboard switches to it.
// Works signed out — a public repo needs no session (issue #1). Signing in is
// only needed for private repositories.
import { useState } from "react";
import "./auth.css";
import { LOGIN_URL } from "../../services/authApi.js";
import { ingestRepo, normalizeRepoUrl } from "../../services/riskApi.js";

// Accepts https://github.com/<owner>/<repo> (after normalizeRepoUrl).
const GITHUB_REPO_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

// Turns a failed ingestion into a message the user can act on.
function describeIngestError(err) {
  if (err.status === 404) {
    return "Could not find that repository. Check the URL is correct and the repo is public.";
  }
  if (err.status === 422) {
    return "Enter a GitHub repository URL, e.g. https://github.com/owner/repo";
  }
  if (err.status === 401) return "Your session has expired. Sign in with GitHub again.";
  if (err.status === 500) return "Something went wrong analyzing this repository. Try again.";
  return err.message;
}

export default function ConnectRepoForm({ user, onConnected }) {
  const [url, setUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

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
      const { url: canonicalUrl } = await ingestRepo(repoUrl);
      setUrl("");
      await onConnected(canonicalUrl ?? repoUrl);
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

      {!user && (
        <p className="connect-repo__hint">
          <a href={LOGIN_URL}>Sign in with GitHub</a> to analyze private repositories.
        </p>
      )}

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
