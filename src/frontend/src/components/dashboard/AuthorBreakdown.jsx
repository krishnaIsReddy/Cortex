// Every author of one file, largest current share first. Shows the current
// (recency-weighted) share that drives the risk score next to the all-time
// share, so it's clear when someone's knowledge of the file has faded.
import { formatDate, formatPercent } from "./format.js";

export default function AuthorBreakdown({ authors }) {
  const sortedAuthors = [...authors].sort((a, b) => b.share - a.share);

  return (
    <div className="risk-table-wrapper">
      <table className="risk-table">
        <thead>
          <tr>
            <th scope="col">Author</th>
            <th scope="col" className="col-number">Current share</th>
            <th scope="col" className="col-number">All-time share</th>
            <th scope="col" className="col-number">Commits</th>
            <th scope="col">Last commit</th>
          </tr>
        </thead>
        <tbody>
          {sortedAuthors.map((author, index) => (
            <tr key={author.name}>
              <th scope="row" className="author-name">{author.name}</th>
              <td className="col-number">
                <div className="share">
                  {/* The top author's bar uses the file's risk color; others stay neutral. */}
                  <div className="share__bar" aria-hidden="true">
                    <div
                      className={index === 0 ? "share__fill" : "share__fill share__fill--neutral"}
                      style={{ width: formatPercent(author.share) }}
                    />
                  </div>
                  {formatPercent(author.share)}
                </div>
              </td>
              <td className="col-number text-muted">{formatPercent(author.historicalShare)}</td>
              <td className="col-number">{author.commitCount ?? "—"}</td>
              <td className="col-nowrap">
                {author.lastCommitAt ? (
                  <time dateTime={author.lastCommitAt}>{formatDate(author.lastCommitAt)}</time>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
