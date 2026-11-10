// React hook that loads a repo's risk history and tracks its state.
// Loaded separately from the risk report, so a slow or failing trend never
// holds up the file table.
import { useEffect, useState } from "react";
import { getRiskTrend } from "../services/riskApi.js";

// Returns { points, loading, error, reload }:
//   points  - monthly points, oldest first (see services/riskApi.js);
//             [] if the repo has no commits
//   loading - true while the request is in progress
//   error   - an Error if the request failed, otherwise null
//   reload  - call to fetch the history again (e.g. a "Retry" button)
// `months` keeps only the latest N months (null = all of the history).
export function useRiskTrend(repoId, months) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumping this number re-runs the effect below, which re-fetches the history.
  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    // Ignore a result that arrives after repoId changed or the component unmounted.
    let ignore = false;

    setLoading(true);
    setError(null);

    getRiskTrend(repoId, months)
      .then((result) => {
        if (!ignore) setPoints(result);
      })
      .catch((err) => {
        console.error(`useRiskTrend: failed to load repo "${repoId}"`, err);
        if (!ignore) setError(err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [repoId, months, reloadCount]);

  return { points, loading, error, reload };
}
