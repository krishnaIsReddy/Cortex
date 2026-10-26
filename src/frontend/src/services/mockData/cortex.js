// Sample: a mixed-risk repo. Borrows our own repo's name and file paths so it
// looks realistic; the numbers are made up, nothing is read from a real repo.
// Includes edge cases: scores exactly on the level boundaries (0.70, 0.40)
// and a very long path. The list is unsorted so we can confirm the UI sorts it.
import { makeFile } from "./makeFile.js";

export const cortexReport = {
  repo: {
    name: "krishnaIsReddy/Cortex",
    url: "https://github.com/krishnaIsReddy/Cortex",
    branch: "main",
    analyzedAt: "2026-10-07T15:30:00Z",
    commitCount: 142,
    contributorCount: 4,
    isSample: true,
  },
  files: [
    makeFile("src/api/routes/auth.py", { josh: 0.94, krishna: 0.06 }),
    makeFile("README.md", { krishna: 0.28, josh: 0.26, muhammad: 0.24, hardeep: 0.22 }),
    // Josh wrote most of this originally, but Krishna has done the recent work.
    makeFile(
      "src/services/ingestion/clone.py",
      { krishna: 0.81, josh: 0.12, muhammad: 0.07 },
      { historicalShares: { krishna: 0.3, josh: 0.62, muhammad: 0.08 } }
    ),
    makeFile("src/db/models/commit.py", { krishna: 0.4, josh: 0.35, muhammad: 0.25 }),
    makeFile("src/services/scoring/ownership.py", { muhammad: 0.7, hardeep: 0.2, krishna: 0.1 }),
    makeFile("src/frontend/src/App.jsx", { hardeep: 0.33, josh: 0.32, krishna: 0.2, muhammad: 0.15 }),
    // Untouched for over a year, so it is flagged as stale.
    makeFile(
      "src/services/alerting/digest.py",
      { muhammad: 0.88, josh: 0.12 },
      { lastChangedAt: "2025-06-14T09:00:00Z" }
    ),
    makeFile("src/api/deps/db_session.py", { josh: 0.52, krishna: 0.48 }),
    makeFile("src/db/repositories/commit_repository.py", { krishna: 0.65, muhammad: 0.35 }),
    makeFile("src/frontend/src/components/dashboard/riskLevels.js", {
      hardeep: 0.31,
      josh: 0.25,
      krishna: 0.24,
      muhammad: 0.2,
    }),
    makeFile("src/services/ingestion/parsers/very/deeply/nested/commit_metadata_parser.py", {
      krishna: 0.77,
      hardeep: 0.23,
    }),
    makeFile("src/ai/explainer.py", { muhammad: 0.99, josh: 0.01 }),
    makeFile("src/api/schemas/file_risk.py", { josh: 0.39, krishna: 0.31, muhammad: 0.3 }),
    makeFile("tests/unit/test_scoring.py", { hardeep: 0.45, muhammad: 0.35, krishna: 0.2 }),
    makeFile(".gitignore", { krishna: 0.27, josh: 0.25, muhammad: 0.24, hardeep: 0.24 }),
  ],
};
