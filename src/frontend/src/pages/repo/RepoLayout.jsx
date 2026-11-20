// Frame around every repo section: the repo header and the section itself
// (<Outlet />). The sections are listed in the sidebar. The risk report is
// loaded once here and shared with every section (see useRepoReport.js), so
// moving between sections doesn't reload it.
import { useEffect, useMemo } from "react";
import { Link, Outlet, useParams } from "react-router";
import "../../components/dashboard/dashboard.css";
import "../../components/layout/layout.css";
import RepoHeader from "../../components/dashboard/RepoHeader.jsx";
import { getRiskLevel } from "../../components/dashboard/riskLevels.js";
import { listFolder } from "../../components/folders/folders.js";
import { summarizePeople } from "../../components/people/people.js";
import { useRiskReport } from "../../hooks/useRiskReport.js";
import { REPOSITORIES_PATH } from "../../routes.js";

// Route element for /repos/:repoId. A new key gives the layout a fresh start
// (data reloads) when switching repos or after the repo is re-analyzed.
export default function RepoRoute({ analysisCount, onRemove, canRemove, onSummary }) {
  const { repoId } = useParams();
  return (
    <RepoLayout
      key={`${repoId}-${analysisCount}`}
      repoId={repoId}
      onRemove={canRemove(repoId) ? () => onRemove(repoId) : undefined}
      onSummary={onSummary}
    />
  );
}

function RepoLayout({ repoId, onRemove, onSummary }) {
  const report = useRiskReport(repoId);
  const { repo, files, loading, error, reload } = report;

  // People are worked out from the report, once, for the sections that use them.
  const people = useMemo(() => summarizePeople(files), [files]);

  // Send the section counts up to the sidebar once the report has loaded.
  useEffect(() => {
    if (loading || error) return;
    onSummary({
      repoId,
      files: files.length,
      folders: listFolder(files, "").folders.length,
      people: people.length,
      highRisk: files.filter((file) => getRiskLevel(file.riskScore).name === "high").length,
    });
  }, [repoId, files, people, loading, error, onSummary]);

  if (error) {
    return (
      <div className="state-message state-message--error" role="alert">
        <p>Could not load this repository: {error.message}</p>
        <div className="state-message__actions">
          <button type="button" className="button" onClick={reload}>
            Retry
          </button>
          <Link to={REPOSITORIES_PATH} className="button">
            All repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="repo-page">
      {repo ? (
        <RepoHeader repo={repo} fileCount={files.length} onRemove={onRemove} />
      ) : (
        <div className="repo-header-skeleton" aria-busy="true" aria-label="Loading repository" />
      )}

      <Outlet context={{ ...report, repoId, people }} />
    </div>
  );
}
