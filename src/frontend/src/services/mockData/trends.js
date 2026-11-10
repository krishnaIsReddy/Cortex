// Sample risk history for the "Risk over time" chart, one point per month.
// Hand-written like the rest of mockData; nothing is read from a real repo.
// Each trend ends on the same numbers as its dataset's file table today.
//
// Each point has the same shape as GET /api/repos/{id}/risk-trend (src/api/schemas/trend.py):
//   periodEnd         - last day of the month (ISO date, e.g. "2026-05-31")
//   highRiskShare     - share of files at high risk at that date, 0 to 1
//                       (high = riskScore of 0.70 or more, see riskLevels.js)
//   highRiskFileCount - number of high-risk files at that date
//   fileCount         - number of files scored at that date
//   commitCount       - commits up to and including that month

// Builds consecutive monthly points starting at `firstMonth` ("2026-05"), so
// dates and shares are calculated rather than typed.
// Each row is [highRiskFileCount, fileCount, commitCount].
function makeTrend(firstMonth, rows) {
  const [year, month] = firstMonth.split("-").map(Number);

  return rows.map(([highRiskFileCount, fileCount, commitCount], index) => {
    // Day 0 of the next month is the last day of this one.
    const lastDay = new Date(Date.UTC(year, month + index, 0));
    return {
      periodEnd: lastDay.toISOString().slice(0, 10),
      highRiskShare: fileCount === 0 ? 0 : highRiskFileCount / fileCount,
      highRiskFileCount,
      fileCount,
      commitCount,
    };
  });
}

// Sample trends keyed by the same repo IDs as sampleReports in index.js.
// "missing-repo" has no trend on purpose, so it shows the error state.
export const sampleTrends = {
  // Started with a few single-author files, then more people joined in.
  cortex: makeTrend("2026-05", [
    [3, 3, 12],
    [3, 5, 30],
    [3, 8, 55],
    [5, 11, 90],
    [5, 13, 120],
    [6, 15, 142],
  ]),

  // Knowledge concentrating over a year: getting worse.
  "payments-service": makeTrend("2025-11", [
    [2, 10, 410],
    [2, 10, 450],
    [3, 10, 490],
    [3, 11, 530],
    [4, 11, 575],
    [4, 11, 610],
    [5, 11, 650],
    [5, 12, 700],
    [6, 12, 745],
    [6, 12, 790],
    [7, 12, 830],
    [7, 12, 860],
  ]),

  // Ownership spreading out over a year: getting better.
  "data-pipeline": makeTrend("2025-11", [
    [6, 10, 980],
    [6, 10, 1030],
    [5, 11, 1080],
    [5, 11, 1130],
    [4, 11, 1180],
    [4, 11, 1230],
    [3, 12, 1280],
    [3, 12, 1330],
    [2, 12, 1380],
    [2, 12, 1430],
    [1, 12, 1480],
    [1, 12, 1530],
  ]),

  // Every commit is from one month, so there's no trend to draw yet.
  "new-project": makeTrend("2026-10", [[0, 0, 3]]),
};
