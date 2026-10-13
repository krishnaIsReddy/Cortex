// Expanded detail for one file: every author's share of the file, largest
// first. This shows the data behind the risk score (the top author's share).
import { formatPercent, pluralize } from "./format.js";

export default function AuthorBreakdown({ authors }) {
  const sortedAuthors = [...authors].sort((a, b) => b.share - a.share);

  return (
    <div className="author-breakdown">
      <p className="author-breakdown__caption">
        {pluralize(authors.length, "author")} wrote this file. The risk score is the
        top author's share.
      </p>

      <ul className="author-breakdown__list">
        {sortedAuthors.map((author, index) => (
          <li key={author.name} className="author-breakdown__item">
            <span>{author.name}</span>
            <div className="share__bar share__bar--wide" aria-hidden="true">
              {/* The top author's bar uses the row's risk color; others stay neutral. */}
              <div
                className={index === 0 ? "share__fill" : "share__fill share__fill--neutral"}
                style={{ width: formatPercent(author.share) }}
              />
            </div>
            <span className="col-number">{formatPercent(author.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
