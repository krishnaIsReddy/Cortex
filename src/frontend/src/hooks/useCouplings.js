// Polls co-change coupling status for a live repo. While the backend is still
// scoring pairs in a background task, status stays "pending" so the UI can
// show "Determining coupling…".
import { useEffect, useState } from "react";
import { getCouplings } from "../services/riskApi.js";

const POLL_MS = 2000;

// Returns { status, couplings, loading, error }:
//   status    - "pending" | "ready" | "failed" | null (samples / unknown)
//   couplings - file pairs once ready (empty until then)
//   loading   - true for the first request only
//   error     - an Error if the request failed, otherwise null
export function useCouplings(repoId) {
  const [status, setStatus] = useState(null);
  const [couplings, setCouplings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    let ignore = false;
    let timerId = null;

    const load = () => {
      getCouplings(repoId)
        .then((result) => {
          if (ignore) return;
          setStatus(result.status);
          setCouplings(result.couplings ?? []);
          setError(null);
          setLoading(false);

          // Keep polling until the background job finishes (or fails).
          if (result.status === "pending") {
            timerId = setTimeout(load, POLL_MS);
          }
        })
        .catch((err) => {
          console.error(`useCouplings: failed to load couplings for "${repoId}"`, err);
          if (ignore) return;
          setError(err);
          setLoading(false);
        });
    };

    setLoading(true);
    setError(null);
    load();

    return () => {
      ignore = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [repoId, reloadCount]);

  return { status, couplings, loading, error, reload };
}
