// Table of files sorted by risk (highest first). Each row is tinted with its
// risk level's color, which makes the list scannable as a simple "heatmap".
// Clicking a file name opens its drill-down (see FileDetail.jsx).
import { useEffect } from "react";
import RiskBadge from "./RiskBadge.jsx";
import { formatDate, formatPercent, formatRelative, isStale } from "./format.js";
import { getRiskLevel, riskClassName } from "./riskLevels.js";

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

// Turns a path into a valid, unique HTML id for the file's button.
function fileButtonId(path) {
  return `file-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

// `onSelectFile(path)` opens a file's drill-down. `focusPath` is the file to
// focus on mount: the one the user just came back from, so keyboard users
// keep their place in the list.
export default function FileRiskTable({ files, onSelectFile, focusPath }) {
  useEffect(() => {
    if (focusPath) document.getElementById(fileButtonId(focusPath))?.focus();
  }, [focusPath]);

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
            <th scope="col">Last changed</th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file) => {
            const level = getRiskLevel(file.riskScore);
            const { dir, name } = splitPath(file.path);

            return (
              <tr key={file.path} className={riskClassName(level)}>
                <td className="file-path">
                  {/* A real button so the file can be opened with the keyboard too. */}
                  <button
                    type="button"
                    id={fileButtonId(file.path)}
                    className="file-toggle"
                    onClick={() => onSelectFile(file.path)}
                  >
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
                <td className="col-nowrap">
                  <time dateTime={file.lastChangedAt} title={formatDate(file.lastChangedAt)}>
                    {formatRelative(file.lastChangedAt)}
                  </time>
                  {isStale(file.lastChangedAt) && <span className="stale-tag">Stale</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
