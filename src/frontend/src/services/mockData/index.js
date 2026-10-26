// All sample risk reports, used until the real scoring API (#4) exists.
// Nothing here is read from a real repository; every number is hand-written.
//
// Each report has the shape we expect the real API to return:
//
//   repo: details about the analyzed repository
//     name             - "owner/repo" as shown on GitHub
//     url              - link to the repo
//     branch           - branch whose history was analyzed
//     analyzedAt       - when the analysis ran (ISO 8601 timestamp)
//     commitCount      - number of commits analyzed
//     contributorCount - number of distinct authors found
//     isSample         - mock-only flag so the UI can label this as sample data;
//                        the real API won't send it, so the label disappears.
//
//   halfLifeDays: commits this many days older than the newest count half as
//     much (added by riskApi.js for samples, sent by the real API)
//
//   files: per-file risk (see makeFile.js for how entries are built)
//     path           - file path relative to the repo root
//     riskScore      - 0 to 1, higher = riskier (see components/dashboard/riskLevels.js)
//     topAuthor      - the author with the largest recency-weighted share
//     topAuthorShare - that author's share of the file, 0 to 1
//     lastChangedAt  - when any commit last changed the file (ISO 8601)
//     authors        - every author, largest share first:
//       name            - display name
//       share           - recency-weighted share, 0 to 1 (adds up to 1)
//       historicalShare - all-time share, every line counted equally
//       commitCount     - commits that changed the file (null in samples)
//       lastCommitAt    - their latest commit to the file (null in samples)
import { cortexReport } from "./cortex.js";
import { dataPipelineReport } from "./dataPipeline.js";
import { newProjectReport } from "./newProject.js";
import { paymentsServiceReport } from "./paymentsService.js";

// Matches HALF_LIFE_DAYS in the backend's src/services/scoring/ownership.py.
export const SAMPLE_HALF_LIFE_DAYS = 180;

// Sample reports keyed by repo ID (the ID the dashboard is given).
export const sampleReports = {
  cortex: cortexReport,
  "payments-service": paymentsServiceReport,
  "data-pipeline": dataPipelineReport,
  "new-project": newProjectReport,
};

// Options for the "Sample data" group of the repo picker, in display order. "missing-repo" has no data
// on purpose, so choosing it shows the dashboard's error state.
export const sampleRepoOptions = [
  { id: "cortex", label: "Cortex (mixed risk)" },
  { id: "payments-service", label: "Payments service (high risk)" },
  { id: "data-pipeline", label: "Data pipeline (low risk)" },
  { id: "new-project", label: "New project (no files yet)" },
  { id: "missing-repo", label: "Unknown repo (error)" },
];
