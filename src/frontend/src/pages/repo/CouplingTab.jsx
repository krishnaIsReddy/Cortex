// Coupling tab: pairs of files that are usually changed in the same commit.
// A risky file's coupled partners share its risk: changing one means
// understanding the other.
//
// Note: PR #23 adds a fuller CouplingPanel; once it merges, it can replace
// the table below.
import { Link } from "react-router";
import { formatPercent } from "../../components/dashboard/format.js";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { useCouplings } from "../../hooks/useCouplings.js";
import { filePath } from "../../routes.js";
import { LOGIN_URL } from "../../services/authApi.js";
import { isLiveRepoId } from "../../services/riskApi.js";
import { useRepoReport } from "./useRepoReport.js";

export default function CouplingTab() {
  const { repoId } = useRepoReport();
  const { status, couplings, loading, error } = useCouplings(repoId);

  let content;
  if (!isLiveRepoId(repoId)) {
    content = (
      <p className="state-message">
        Sample data has no commit history, so there is no coupling to show. Pick
        an analyzed repository to see which files change together.
      </p>
    );
  } else if (loading) {
    content = <TabSkeleton label="Loading coupling" />;
  } else if (error?.status === 401) {
    content = (
      <p className="state-message">
        <span>
          <a href={LOGIN_URL}>Sign in with GitHub</a> to see which files change together.
        </span>
      </p>
    );
  } else if (error) {
    content = (
      <p className="state-message state-message--error" role="alert">
        Could not load coupling: {error.message}
      </p>
    );
  } else if (status === "pending") {
    content = (
      <p className="state-message" aria-live="polite">
        Working out which files change together. This updates by itself when it's done.
      </p>
    );
  } else if (status === "failed") {
    content = (
      <p className="state-message state-message--error" role="alert">
        Could not determine file coupling for this repository.
      </p>
    );
  } else if (couplings.length === 0) {
    content = (
      <p className="state-message">
        No pairs of files change together often enough to count as coupled.
      </p>
    );
  } else {
    content = <CouplingTable repoId={repoId} couplings={couplings} />;
  }

  return (
    <section className="tab-panel" aria-labelledby="coupling-title">
      <header className="dashboard__header">
        <h2 id="coupling-title" className="dashboard__title">Files that change together</h2>
        <p className="dashboard__subtitle">
          Pairs of files usually changed in the same commit. Coupling is the share
          of the busier file's commits that also touched the other one.
        </p>
      </header>
      {content}
    </section>
  );
}

function CouplingTable({ repoId, couplings }) {
  const sorted = [...couplings].sort((a, b) => b.couplingScore - a.couplingScore);

  return (
    <div className="risk-table-wrapper">
      <table className="risk-table">
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col">Changes with</th>
            <th scope="col" className="col-number">Coupling</th>
            <th scope="col" className="col-number">Commits together</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((pair) => (
            <tr key={`${pair.fileA}|${pair.fileB}`}>
              <td className="file-path">
                <Link to={filePath(repoId, pair.fileA)} className="file-link">{pair.fileA}</Link>
              </td>
              <td className="file-path">
                <Link to={filePath(repoId, pair.fileB)} className="file-link">{pair.fileB}</Link>
              </td>
              <td className="col-number">{formatPercent(pair.couplingScore)}</td>
              <td className="col-number">{pair.coCommitCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
