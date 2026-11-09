// Polls co-change coupling status for a live repo. While the backend is still
// scoring pairs in a background task, status stays "pending" so the UI can
// show "Determining coupling…".
import { useEffect, useState } from "react";
import { getCouplings, isLiveRepoId } from "../services/riskApi.js";

const POLL_MS = 2000;

// Returns { status, couplings, loading, error }:
//   status    - "pending" | "ready" | "failed" | null (samples / unknown)
//   couplings - file pairs once ready (empty until then)
//   loading   - true for the first request only
//   error     - an Error if the request failed, otherwise null
export function useCouplings(repoId) {
  const [status, setStatus] = useState(null);
  const [couplings, setCouplings] = useState([]);
  const [loading, setLoading] = useState(() => isLiveRepoId(repoId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLiveRepoId(repoId)) {
      setStatus(null);
      setCouplings([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

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
  }, [repoId]);

  return { status, couplings, loading, error };
}
