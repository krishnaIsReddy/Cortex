// One file's drill-down, at /repos/<id>/files/<file path>. Wraps FileDetail
// with routing: "back" returns to the Files tab with its filters, author names
// link to their People page, and files that often change alongside this one
// (from co-change coupling) link to their own drill-downs.
import { Link, useLocation, useNavigate, useParams } from "react-router";
import FileDetail from "../../components/dashboard/FileDetail.jsx";
import { formatPercent } from "../../components/dashboard/format.js";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { useCouplings } from "../../hooks/useCouplings.js";
import { filePath, personPath, repoPath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

// At most this many coupled files are listed under the drill-down.
const MAX_COUPLED_FILES = 5;

export default function FileTab() {
  const { repoId, repo, loading } = useRepoReport();
  const path = useParams()["*"];
  const navigate = useNavigate();
  const location = useLocation();

  // Back to the Files tab, with the filters it had, focusing this file's row.
  const goBack = () => {
    navigate(`${repoPath(repoId, "files")}${location.state?.listSearch ?? ""}`, {
      state: { focusPath: path },
    });
  };

  // Commit links are built from the repo's URL, so wait for the report.
  if (loading) return <TabSkeleton label="Loading file details" rows={3} />;

  return (
    <>
      <FileDetail
        // A new key resets the view (and its focus handling) per file.
        key={path}
        repoId={repoId}
        repoUrl={repo?.url}
        path={path}
        onBack={goBack}
        authorHref={(name) => personPath(repoId, name)}
      />
      <CoupledFiles repoId={repoId} path={path} />
    </>
  );
}

// "Often changes with": the files most often committed together with this one.
// Hidden when there's no coupling data (sample repos, still computing, or the
// request failed); the Coupling tab explains those states.
function CoupledFiles({ repoId, path }) {
  const { status, couplings } = useCouplings(repoId);
  if (status !== "ready") return null;

  const partners = couplings
    .filter((pair) => pair.fileA === path || pair.fileB === path)
    .map((pair) => ({
      path: pair.fileA === path ? pair.fileB : pair.fileA,
      score: pair.couplingScore,
      together: pair.coCommitCount,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_COUPLED_FILES);

  if (partners.length === 0) return null;

  return (
    <section className="file-detail__section" aria-labelledby="coupled-files-title">
      <h3 id="coupled-files-title" className="file-detail__heading">Often changes with</h3>
      <p className="file-detail__caption">
        Changing this file usually means changing these too. Whoever owns them
        is worth looping in.
      </p>
      <ul className="link-list">
        {partners.map((partner) => (
          <li key={partner.path}>
            <Link to={filePath(repoId, partner.path)} className="link-list__path">
              {partner.path}
            </Link>
            <span className="link-list__meta">
              {formatPercent(partner.score)} coupled · {partner.together} commits together
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
