// Coupling commit-window presets shared by ingest and recompute UI.
// Keep DEFAULT_MAX_COMMITS in sync with the backend
// (src/services/scoring/coupling.py).

export const DEFAULT_COUPLING_MAX_COMMITS = 5000;

export const COUPLING_WINDOW_MODES = {
  standard: "standard",
  custom: "custom",
};

// Turns form state into the API body fields { maxCommits, since }.
// Standard → last 5,000 commits. Custom → optional count + optional since date.
export function buildCouplingWindowPayload({ mode, maxCommits, since }) {
  if (mode !== COUPLING_WINDOW_MODES.custom) {
    return { maxCommits: DEFAULT_COUPLING_MAX_COMMITS, since: null };
  }

  const trimmed = String(maxCommits ?? "").trim();
  let parsedMax = null;
  if (trimmed !== "") {
    const n = Number(trimmed);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("Max commits must be a positive whole number, or left blank for all history.");
    }
    parsedMax = n;
  }

  const sinceValue = String(since ?? "").trim();
  return {
    maxCommits: parsedMax,
    since: sinceValue ? new Date(`${sinceValue}T00:00:00.000Z`).toISOString() : null,
  };
}
