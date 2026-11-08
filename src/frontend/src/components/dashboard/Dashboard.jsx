// Heatmap dashboard (v1): loads a repo's risk report and shows which repo was
// analyzed, how scoring works, and every file in a table sorted by risk.
// Clicking a file swaps the table for that file's drill-down.
// Handles every state explicitly so failures are never silent.
import { useState } from "react";
import "./dashboard.css";
import FileDetail from "./FileDetail.jsx";
import FileRiskTable from "./FileRiskTable.jsx";
import RepoHeader from "./RepoHeader.jsx";
import RiskExplainer from "./RiskExplainer.jsx";
import RiskFilters from "./RiskFilters.jsx";
import { getRiskLevel } from "./riskLevels.js";
import { useRiskReport } from "../../hooks/useRiskReport.js";

// Number of placeholder rows shown while data is loading.
const SKELETON_ROW_COUNT = 6;

// Returns the files that match the search text (case-insensitive, anywhere in
// the path) and the selected risk level (null = all levels).
function filterFiles(files, query, selectedLevel) {
  const normalizedQuery = query.trim().toLowerCase();

  return files.filter((file) => {
    const matchesQuery = file.path.toLowerCase().includes(normalizedQuery);
    const matchesLevel =
      selectedLevel === null || getRiskLevel(file.riskScore).name === selectedLevel;
    return matchesQuery && matchesLevel;
  });
}

// `onRemoveRepo` is optional; when given, the header shows a "Remove" button.
export default function Dashboard({ repoId, onRemoveRepo }) {
  const { repo, halfLifeDays, files, loading, error, reload } = useRiskReport(repoId);

  // The file whose drill-down is open (null = show the table), and the file
  // the user last came back from, so the table can return focus to it.
  const [selectedPath, setSelectedPath] = useState(null);
  const [lastViewedPath, setLastViewedPath] = useState(null);

  const closeFile = () => {
    setLastViewedPath(selectedPath);
    setSelectedPath(null);
  };

  // Filter state: search text and selected risk level (null = show all levels).
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(null);

  const clearFilters = () => {
    setQuery("");
    setSelectedLevel(null);
  };

  const visibleFiles = filterFiles(files, query, selectedLevel);
  const hasFiles = !loading && !error && files.length > 0;

  // Pick what to show based on the hook's state, checked in priority order.
  let content;
  if (loading) {
    content = <LoadingState />;
  } else if (error) {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not load the risk report: {error.message}</p>
        <button type="button" className="button" onClick={reload}>
          Retry
        </button>
      </div>
    );
  } else if (files.length === 0) {
    content = (
      <p className="state-message">
        No files have been scored for this repository yet. Once its history is
        analyzed, files will appear here sorted by risk.
      </p>
    );
  } else if (visibleFiles.length === 0) {
    content = (
      <div className="state-message">
        <p>No files match the current filters.</p>
        <button type="button" className="button" onClick={clearFilters}>
          Clear filters
        </button>
      </div>
    );
  } else {
    content = (
      <FileRiskTable
        files={visibleFiles}
        onSelectFile={setSelectedPath}
        focusPath={lastViewedPath}
      />
    );
  }

  // Filters stay in state while a file is open, so going back keeps them.
  if (selectedPath !== null && repo) {
    return (
      <section className="dashboard">
        <RepoHeader repo={repo} fileCount={files.length} onRemove={onRemoveRepo} />
        <FileDetail repoId={repoId} repoUrl={repo.url} path={selectedPath} onBack={closeFile} />
      </section>
    );
  }

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      {repo && <RepoHeader repo={repo} fileCount={files.length} onRemove={onRemoveRepo} />}
      <RiskExplainer halfLifeDays={halfLifeDays} />

      <header className="dashboard__header">
        <h2 id="dashboard-title" className="dashboard__title">File risk</h2>
        <p className="dashboard__subtitle">
          Files where most of the code was written by one person, riskiest first.
          Click a file to see its authors and recent commits.
        </p>
      </header>

      {hasFiles && (
        <RiskFilters
          files={files}
          query={query}
          onQueryChange={setQuery}
          selectedLevel={selectedLevel}
          onSelectedLevelChange={setSelectedLevel}
        />
      )}

      {/* Announced to screen readers when the filtered count changes. */}
      {hasFiles && (
        <p className="dashboard__count" aria-live="polite">
          Showing {visibleFiles.length} of {files.length} files
        </p>
      )}

      {content}
    </section>
  );
}

// Grey placeholder rows that pulse while data loads (static if the user
// prefers reduced motion; see dashboard.css).
function LoadingState() {
  return (
    <div className="risk-table-wrapper" aria-busy="true" aria-label="Loading file risks">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}
