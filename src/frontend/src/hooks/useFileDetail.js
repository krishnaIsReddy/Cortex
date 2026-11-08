// React hook that loads one file's drill-down (authors + recent commits).
// Works like useRiskReport; see that hook for how stale requests are ignored.
import { useEffect, useState } from "react";
import { getFileDetail } from "../services/riskApi.js";

// Returns { detail, loading, error, reload }:
//   detail  - the file's drill-down (null until loaded)
//   loading - true while the request is in progress
//   error   - an Error if the request failed, otherwise null
//   reload  - call to fetch the detail again (e.g. a "Retry" button)
export function useFileDetail(repoId, path) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reloadCount, setReloadCount] = useState(0);
  const reload = () => setReloadCount((count) => count + 1);

  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError(null);

    getFileDetail(repoId, path)
      .then((result) => {
        if (!ignore) setDetail(result);
      })
      .catch((err) => {
        console.error(`useFileDetail: failed to load "${path}" in repo "${repoId}"`, err);
        if (!ignore) setError(err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [repoId, path, reloadCount]);

  return { detail, loading, error, reload };
}
