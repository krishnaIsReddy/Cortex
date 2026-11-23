// Co-change coupling: files that tend to change in the same commits.
// The whole section is a native <details> so it can be collapsed without
// custom JS. Clicking a path opens that file's drill-down when provided.
import { formatPercent } from "./format.js";

export default function CouplingPanel({
  status,
  couplings,
  loading,
  error,
  onRetry,
  onSelectFile,
}) {
  let content;
  if (loading && status !== "pending") {
    content = (
      <div className="risk-table-wrapper" aria-busy="true" aria-label="Loading coupled files">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  } else if (error) {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not load coupled files: {error.message}</p>
        {onRetry && (
          <button type="button" className="button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  } else if (status === "pending") {
    content = (
      <p className="coupling-status" aria-live="polite">
        Determining coupling…
      </p>
    );
  } else if (status === "failed") {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not determine file coupling for this repository.</p>
        {onRetry && (
          <button type="button" className="button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  } else if (!couplings.length) {
    content = (
      <p className="state-message">
        No strongly coupled file pairs yet. Pairs appear after enough commits
        change the same files together.
      </p>
    );
  } else {
    content = <CouplingTable couplings={couplings} onSelectFile={onSelectFile} />;
  }

  const pairCount =
    status === "ready" && !error && !loading ? couplings.length : null;
  const summaryLabel =
    pairCount === null
      ? "Coupled files"
      : `Coupled files (${pairCount} ${pairCount === 1 ? "pair" : "pairs"})`;

  return (
    <details className="coupling-panel" open>
      <summary className="coupling-panel__summary">{summaryLabel}</summary>
      <div className="coupling-panel__body">
        <p className="dashboard__subtitle">
          Files that often change in the same commits. A higher score means the
          pair moves together more of the time — useful when planning refactors
          or reviews.
        </p>
        {content}
      </div>
    </details>
  );
}

function CouplingTable({ couplings, onSelectFile }) {
  return (
    <>
      <p className="dashboard__count" aria-live="polite">
        {couplings.length} pairs, strongest first
      </p>
      <div className="risk-table-wrapper">
        <table className="risk-table">
          <thead>
            <tr>
              <th scope="col">File A</th>
              <th scope="col">File B</th>
              <th scope="col" className="col-number">Shared commits</th>
              <th scope="col" className="col-number">Score</th>
            </tr>
          </thead>
          <tbody>
            {couplings.map((pair) => (
              <tr key={`${pair.fileA}::${pair.fileB}`}>
                <td className="file-path">
                  <FilePathCell path={pair.fileA} onSelectFile={onSelectFile} />
                </td>
                <td className="file-path">
                  <FilePathCell path={pair.fileB} onSelectFile={onSelectFile} />
                </td>
                <td className="col-number">
                  {pair.coCommitCount}
                  <span className="text-muted">
                    {" "}
                    / {Math.max(pair.totalCommitsA, pair.totalCommitsB)}
                  </span>
                </td>
                <td className="col-number">
                  <div className="share">
                    <div className="share__bar" aria-hidden="true">
                      <div
                        className="share__fill share__fill--neutral"
                        style={{ width: formatPercent(pair.couplingScore) }}
                      />
                    </div>
                    {formatPercent(pair.couplingScore)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FilePathCell({ path, onSelectFile }) {
  const lastSlash = path.lastIndexOf("/");
  const dir = path.slice(0, lastSlash + 1);
  const name = path.slice(lastSlash + 1);

  if (!onSelectFile) {
    return (
      <span>
        <span className="file-path__dir">{dir}</span>
        {name}
      </span>
    );
  }

  return (
    <button type="button" className="file-toggle" onClick={() => onSelectFile(path)}>
      <span>
        <span className="file-path__dir">{dir}</span>
        {name}
      </span>
    </button>
  );
}
