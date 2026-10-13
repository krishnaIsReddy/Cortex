// React hook that loads a repo's risk report and tracks its state.
// Components use this instead of calling the API directly.
import { useEffect, useState } from "react";
import { getRiskReport } from "../services/riskApi.js";

// Returns { repo, files, loading, error, reload }:
//   repo    - details about the analyzed repo (null until loaded)
//   files   - array of file risk objects (empty until loaded)
//   loading - true while the request is in progress
//   error   - an Error if the request failed, otherwise null
//   reload  - call to fetch the report again (e.g. a "Retry" button)
export function useRiskReport(repoId) {
  const [report, setReport] = useState({ repo: null, files: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumping this number re-runs the effect below, which re-fetches the report.
  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    // If repoId changes (or the component unmounts) before the request
    // finishes, ignore the old result so it can't overwrite newer state.
    let ignore = false;

    setLoading(true);
    setError(null);

    getRiskReport(repoId)
      .then((result) => {
        if (!ignore) setReport(result);
      })
      .catch((err) => {
        // Log the full error for debugging; the UI shows err.message.
        console.error(`useRiskReport: failed to load repo "${repoId}"`, err);
        if (!ignore) setError(err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [repoId, reloadCount]);

  return { repo: report.repo, files: report.files, loading, error, reload };
}
