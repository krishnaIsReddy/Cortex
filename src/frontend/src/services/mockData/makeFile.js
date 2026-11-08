// Builds one mock file-risk entry from its author shares, so every dataset
// stays internally consistent (top author and score are calculated, not typed).
//
// Example:
//   makeFile("src/auth.py", { josh: 0.94, krishna: 0.06 })
//   -> { path: "src/auth.py", riskScore: 0.94, topAuthor: "josh",
//        topAuthorShare: 0.94, lastChangedAt: "2026-09-28T12:00:00Z",
//        authors: [{ name: "josh", share: 0.94, historicalShare: 0.94, ... }, ...] }
//
// Shares should add up to 1. The risk score is the top author's share.
//
// Options:
//   lastChangedAt    - when the file last changed (defaults to a recent date)
//   historicalShares - all-time shares, when they should differ from the
//                      recency-weighted ones (defaults to the same shares)
export function makeFile(path, sharesByAuthor, options = {}) {
  const { lastChangedAt = "2026-09-28T12:00:00Z", historicalShares = sharesByAuthor } = options;

  const authors = Object.entries(sharesByAuthor)
    .map(([name, share]) => ({
      name,
      share,
      historicalShare: historicalShares[name] ?? share,
      // Sample data has no commit history, so these are unknown.
      commitCount: null,
      lastCommitAt: null,
    }))
    .sort((a, b) => b.share - a.share);

  const topAuthor = authors[0];

  return {
    path,
    riskScore: topAuthor.share,
    topAuthor: topAuthor.name,
    topAuthorShare: topAuthor.share,
    lastChangedAt,
    authors,
  };
}
