// Sample co-change coupling pairs for the dashboard. Hand-written like the
// other mockData files; nothing is read from a real repository.
//
// Each pair matches GET /api/repos/{id}/couplings (schemas/coupling.py):
//   fileA, fileB, coCommitCount, totalCommitsA, totalCommitsB, couplingScore

function pair(fileA, fileB, coCommitCount, totalCommitsA, totalCommitsB) {
  return {
    fileA,
    fileB,
    coCommitCount,
    totalCommitsA,
    totalCommitsB,
    couplingScore: coCommitCount / Math.max(totalCommitsA, totalCommitsB),
  };
}

// Sample couplings keyed by the same repo IDs as sampleReports.
export const sampleCouplings = {
  // Paths match cortex.js so clicking a pair opens an existing file drill-down.
  cortex: [
    pair(
      "src/services/ingestion/clone.py",
      "src/services/ingestion/parsers/very/deeply/nested/commit_metadata_parser.py",
      12,
      14,
      15
    ),
    pair("src/db/models/commit.py", "src/db/repositories/commit_repository.py", 9, 11, 10),
    pair("src/api/routes/auth.py", "src/api/deps/db_session.py", 7, 10, 8),
    pair("src/frontend/src/App.jsx", "src/frontend/src/components/dashboard/riskLevels.js", 6, 9, 7),
    pair("src/services/scoring/ownership.py", "tests/unit/test_scoring.py", 5, 8, 6),
  ].map((row) => ({
    ...row,
    couplingScore: Number(row.couplingScore.toFixed(4)),
  })),

  // Tight billing cluster: high co-change scores.
  "payments-service": [
    pair("src/billing/charge.ts", "src/billing/refund.ts", 28, 30, 29),
    pair("src/billing/charge.ts", "src/ledger/ledger.ts", 22, 30, 25),
    pair("src/gateways/stripe.ts", "src/gateways/paypal.ts", 11, 18, 14),
    pair("src/api/routes.ts", "src/api/middleware/auth.ts", 8, 16, 12),
  ].map((row) => ({
    ...row,
    couplingScore: Number(row.couplingScore.toFixed(4)),
  })),

  // Looser coupling across a shared pipeline.
  "data-pipeline": [
    pair("pipeline/extract/s3_reader.py", "pipeline/transform/clean.py", 14, 20, 22),
    pair("pipeline/transform/clean.py", "pipeline/transform/dedupe.py", 11, 22, 15),
    pair("pipeline/load/warehouse.py", "pipeline/load/schema.py", 9, 12, 11),
    pair("pipeline/scheduler/dag.py", "pipeline/utils/retry.py", 6, 10, 14),
  ].map((row) => ({
    ...row,
    couplingScore: Number(row.couplingScore.toFixed(4)),
  })),

  // Too new for meaningful pairs.
  "new-project": [],
};
