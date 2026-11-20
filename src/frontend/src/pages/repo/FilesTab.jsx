// Files tab: every file in a table sorted by risk, with a path search and
// risk-level filter. Clicking a file opens its drill-down (FileTab.jsx).
// The filters live in the URL (?q=...&level=high), so they survive opening a
// file and coming back, and a filtered list can be linked to.
import { useLocation, useNavigate, useSearchParams } from "react-router";
import FileRiskTable from "../../components/dashboard/FileRiskTable.jsx";
import RiskFilters from "../../components/dashboard/RiskFilters.jsx";
import { getRiskLevel } from "../../components/dashboard/riskLevels.js";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { filePath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

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

export default function FilesTab() {
  const { repoId, files, loading } = useRepoReport();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const selectedLevel = searchParams.get("level");

  // Updates one filter in the URL. `replace` so typing in the search box
  // doesn't add a history entry per keystroke.
  const setFilter = (name, value) => {
    setSearchParams(
      (params) => {
        if (value) params.set(name, value);
        else params.delete(name);
        return params;
      },
      { replace: true }
    );
  };

  // Remember the filters, so the drill-down's "back" returns to this view.
  const openFile = (path) => {
    navigate(filePath(repoId, path), { state: { listSearch: location.search } });
  };

  if (loading) return <TabSkeleton label="Loading file risks" />;

  if (files.length === 0) {
    return (
      <p className="state-message">
        No files have been scored for this repository yet. Once its history is
        analyzed, files will appear here sorted by risk.
      </p>
    );
  }

  const visibleFiles = filterFiles(files, query, selectedLevel);

  return (
    <section className="tab-panel" aria-labelledby="files-title">
      <header className="dashboard__header">
        <h2 id="files-title" className="dashboard__title">File risk</h2>
        <p className="dashboard__subtitle">
          Files where most of the code was written by one person, riskiest first.
          Click a file to see its authors and recent commits.
        </p>
      </header>

      <RiskFilters
        files={files}
        query={query}
        onQueryChange={(value) => setFilter("q", value)}
        selectedLevel={selectedLevel}
        onSelectedLevelChange={(value) => setFilter("level", value)}
      />

      {/* Announced to screen readers when the filtered count changes. */}
      <p className="dashboard__count" aria-live="polite">
        Showing {visibleFiles.length} of {files.length} files
      </p>

      {visibleFiles.length === 0 ? (
        <div className="state-message">
          <p>No files match the current filters.</p>
          <button type="button" className="button" onClick={() => setSearchParams({}, { replace: true })}>
            Clear filters
          </button>
        </div>
      ) : (
        <FileRiskTable
          files={visibleFiles}
          onSelectFile={openFile}
          // Set by the drill-down's "back", so keyboard users keep their place.
          focusPath={location.state?.focusPath}
        />
      )}
    </section>
  );
}
