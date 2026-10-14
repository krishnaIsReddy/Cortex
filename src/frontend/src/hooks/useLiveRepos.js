// React hook that loads the list of repos ingested by the backend.
import { useEffect, useState } from "react";
import { listLiveRepos } from "../services/riskApi.js";

// Returns { repos, loading, error, reload }:
//   repos   - [{ id, name, url, analyzedAt }], newest first (empty until loaded)
//   loading - true while the first request is in progress
//   error   - an Error if the request failed (e.g. backend not running), else null
//   reload  - fetches the list again; returns a Promise of the new list
//             (used after a repo is ingested, to find and select it)
export function useLiveRepos() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Ignore the result if the component unmounts before the request finishes.
    let ignore = false;

    listLiveRepos()
      .then((result) => {
        if (!ignore) setRepos(result);
      })
      .catch((err) => {
        // Not fatal: sample datasets still work without the backend.
        console.warn("useLiveRepos: could not load live repos", err);
        if (!ignore) setError(err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const reload = async () => {
    const result = await listLiveRepos();
    setRepos(result);
    setError(null);
    return result;
  };

  return { repos, loading, error, reload };
}
