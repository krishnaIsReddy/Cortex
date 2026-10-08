// Builds one mock file-risk entry from its author shares, so every dataset
// stays internally consistent (top author and score are calculated, not typed).
//
// Example:
//   makeFile("src/auth.py", { josh: 0.94, krishna: 0.06 })
//   -> { path: "src/auth.py", riskScore: 0.94, topAuthor: "josh",
//        topAuthorShare: 0.94, authors: [{ name: "josh", share: 0.94 }, ...] }
//
// Shares should add up to 1. For v1, riskScore = the top author's share.
export function makeFile(path, sharesByAuthor) {
  const authors = Object.entries(sharesByAuthor)
    .map(([name, share]) => ({ name, share }))
    .sort((a, b) => b.share - a.share);

  const topAuthor = authors[0];

  return {
    path,
    riskScore: topAuthor.share,
    topAuthor: topAuthor.name,
    topAuthorShare: topAuthor.share,
    authors,
  };
}
