// Shows coupling job status and lets the user recompute with a standard or
// custom commit window (live repos only; requires a signed-in session).
import { useState } from "react";
import CouplingWindowFields from "./CouplingWindowFields.jsx";
import {
  buildCouplingWindowPayload,
  COUPLING_WINDOW_MODES,
} from "../../services/couplingWindow.js";
import { isLiveRepoId, recomputeCouplings } from "../../services/riskApi.js";
import "./couplingWindow.css";

function describeRecomputeError(err) {
  if (err.status === 401) return "Sign in with GitHub to recompute coupling.";
  if (err.status === 404) return "Repository not found.";
  if (err.status === 422) return "Check the custom window values and try again.";
  return err.message;
}

export default function CouplingPanel({ repoId, status, onRecomputed }) {
  const [windowMode, setWindowMode] = useState(COUPLING_WINDOW_MODES.standard);
  const [maxCommits, setMaxCommits] = useState("");
  const [since, setSince] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  if (!isLiveRepoId(repoId)) {
    return null;
  }

  const handleRecompute = async (event) => {
    event.preventDefault();

    let windowPayload;
    try {
      windowPayload = buildCouplingWindowPayload({
        mode: windowMode,
        maxCommits,
        since,
      });
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await recomputeCouplings(repoId, windowPayload);
      onRecomputed?.();
    } catch (err) {
      console.error(`CouplingPanel: recompute failed for ${repoId}`, err);
      setError(describeRecomputeError(err));
    } finally {
      setWorking(false);
    }
  };

  const pending = status === "pending" || working;

  return (
    <section className="coupling-panel" aria-labelledby="coupling-panel-title">
      <header className="coupling-panel__header">
        <h2 id="coupling-panel-title" className="coupling-panel__title">
          File coupling
        </h2>
        <p className="coupling-panel__subtitle">
          Files that often change in the same commits. Re-run with a wider window
          if you need older history.
        </p>
      </header>

      {pending && (
        <p className="coupling-status" aria-live="polite">
          Determining coupling…
        </p>
      )}
      {status === "failed" && !working && (
        <p className="coupling-status coupling-status--error" role="alert">
          Could not determine file coupling for this repository.
        </p>
      )}
      {status === "ready" && !working && (
        <p className="coupling-status" aria-live="polite">
          Coupling is ready. Adjust the window below to recompute.
        </p>
      )}

      <form className="coupling-panel__form" onSubmit={handleRecompute}>
        <CouplingWindowFields
          idPrefix="recompute"
          mode={windowMode}
          onModeChange={setWindowMode}
          maxCommits={maxCommits}
          onMaxCommitsChange={setMaxCommits}
          since={since}
          onSinceChange={setSince}
          disabled={pending}
        />
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Computing…" : "Recompute coupling"}
        </button>
      </form>

      {error && (
        <p className="coupling-panel__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
