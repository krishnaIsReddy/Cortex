// Gives a repo tab the data RepoLayout loaded for it.
import { useOutletContext } from "react-router";

// Returns { repoId, repo, halfLifeDays, files, people, loading, error, reload }.
// See useRiskReport.js for the report fields and people.js for `people`.
// Tabs only render after an error is ruled out (RepoLayout shows it instead).
export function useRepoReport() {
  return useOutletContext();
}
