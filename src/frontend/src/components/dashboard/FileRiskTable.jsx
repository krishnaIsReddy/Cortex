// Table of files sorted by risk (highest first). Each row is tinted with its
// risk level's color, which makes the list scannable as a simple "heatmap".
// Clicking a file name expands a row underneath showing every author's share.
import { Fragment, useState } from "react";
import AuthorBreakdown from "./AuthorBreakdown.jsx";
import RiskBadge from "./RiskBadge.jsx";
import { formatPercent } from "./format.js";
import { getRiskLevel, riskClassName } from "./riskLevels.js";

// Number of columns, used so the expanded detail row spans the full width.
const COLUMN_COUNT = 5;

// Returns a new array sorted by riskScore, highest first (input is not changed).
function sortByRiskDescending(files) {
  return [...files].sort((a, b) => b.riskScore - a.riskScore);
}

// Splits "src/api/auth.py" into { dir: "src/api/", name: "auth.py" }
// so the file name can be shown brighter than its folder.
function splitPath(path) {
  const lastSlash = path.lastIndexOf("/");
  return {
    dir: path.slice(0, lastSlash + 1),
    name: path.slice(lastSlash + 1),
  };
}

// Adds an invisible line-break hint (<wbr>) after each "/" so long paths wrap
// between folders instead of mid-word. Copying the text is unaffected.
function withBreakHints(dir) {
  return dir.split("/").map((segment, index, segments) =>
    index < segments.length - 1 ? (
      <span key={index}>
        {segment}/<wbr />
      </span>
    ) : (
      segment
    )
  );
}

// Turns a path into a valid, unique HTML id for aria-controls.
function detailRowId(path) {
  return `authors-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function FileRiskTable({ files }) {
  // Path of the file whose author breakdown is open (only one at a time).
  const [expandedPath, setExpandedPath] = useState(null);

  const toggleExpanded = (path) => {
    setExpandedPath((current) => (current === path ? null : path));
  };

  const sortedFiles = sortByRiskDescending(files);

  return (
    <div className="risk-table-wrapper">
      <table className="risk-table">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Risk</th>
            <th scope="col" className="col-number">Score</th>
            <th scope="col">Top author</th>
            <th scope="col" className="col-number">Top author share</th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file) => {
            const level = getRiskLevel(file.riskScore);
            const { dir, name } = splitPath(file.path);
            const isExpanded = expandedPath === file.path;

            return (
              <Fragment key={file.path}>
                <tr className={riskClassName(level)}>
                  <td className="file-path">
                    {/* A real button so the row can be opened with the keyboard too. */}
                    <button
                      type="button"
                      className="file-toggle"
                      aria-expanded={isExpanded}
                      aria-controls={detailRowId(file.path)}
                      onClick={() => toggleExpanded(file.path)}
                    >
                      <span className="file-toggle__chevron" aria-hidden="true">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <span>
                        <span className="file-path__dir">{withBreakHints(dir)}</span>
                        {name}
                      </span>
                    </button>
                  </td>
                  <td>
                    <RiskBadge level={level} />
                  </td>
                  <td className="col-number">{file.riskScore.toFixed(2)}</td>
                  <td>{file.topAuthor}</td>
                  <td className="col-number">
                    <div className="share">
                      {/* Decorative bar; the percentage next to it is the real value. */}
                      <div className="share__bar" aria-hidden="true">
                        <div
                          className="share__fill"
                          style={{ width: formatPercent(file.topAuthorShare) }}
                        />
                      </div>
                      {formatPercent(file.topAuthorShare)}
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr id={detailRowId(file.path)} className={`detail-row ${riskClassName(level)}`}>
                    <td colSpan={COLUMN_COUNT}>
                      <AuthorBreakdown authors={file.authors} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
