// Folders: browse the repo one folder at a time, with each subfolder's risk
// mix and main owner, so you can see which part of the codebase the risk sits
// in. The open folder is in the URL (?path=src/api), so it can be linked to
// and the back button walks back up.
import { Link, useSearchParams } from "react-router";
import RiskBadge from "../../components/dashboard/RiskBadge.jsx";
import { formatPercent, pluralize } from "../../components/dashboard/format.js";
import { getRiskLevel } from "../../components/dashboard/riskLevels.js";
import { baseName, listFolder, summarizeFiles } from "../../components/folders/folders.js";
import Icon from "../../components/layout/Icon.jsx";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import Avatar from "../../components/viz/Avatar.jsx";
import RiskMix from "../../components/viz/RiskMix.jsx";
import ShareBar from "../../components/viz/ShareBar.jsx";
import { filePath, folderPath, personPath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

export default function FoldersTab() {
  const { repoId, repo, files, loading } = useRepoReport();
  const [searchParams] = useSearchParams();
  const dir = (searchParams.get("path") ?? "").replace(/^\/+|\/+$/g, "");

  if (loading) return <TabSkeleton label="Loading folders" />;

  const contents = listFolder(files, dir);
  const inFolder = dir ? files.filter((file) => file.path.startsWith(`${dir}/`)) : files;
  const summary = summarizeFiles(inFolder);

  // "src/api" -> [{ name: "src", path: "src" }, { name: "api", path: "src/api" }]
  const crumbs = dir
    ? dir.split("/").map((name, index, parts) => ({ name, path: parts.slice(0, index + 1).join("/") }))
    : [];
  const rootName = repo?.name?.split("/").pop() ?? "Repository";

  return (
    <section className="tab-panel" aria-labelledby="folders-title">
      <header className="dashboard__header">
        <h2 id="folders-title" className="dashboard__title">Folders</h2>
        <nav aria-label="Folder path">
          <ol className="breadcrumbs">
            <li>
              {dir ? <Link to={folderPath(repoId)}>{rootName}</Link> : <span aria-current="page">{rootName}</span>}
            </li>
            {crumbs.map((crumb, index) => (
              <li key={crumb.path}>
                {index === crumbs.length - 1 ? (
                  <span aria-current="page">{crumb.name}</span>
                ) : (
                  <Link to={folderPath(repoId, crumb.path)}>{crumb.name}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {inFolder.length === 0 ? (
        <div className="state-message">
          <p>No scored files in “{dir}”.</p>
          <Link to={folderPath(repoId)} className="button">
            Back to the top
          </Link>
        </div>
      ) : (
        <>
          <div className="folder-summary">
            <div className="folder-summary__mix">
              <RiskMix files={inFolder} legend />
            </div>
            <p className="folder-summary__text">
              {pluralize(inFolder.length, "file")}
              {summary.highCount > 0 && (
                <>
                  , <span className="risk--high risk-text">{summary.highCount} high-risk</span>
                </>
              )}
              {summary.topOwner && (
                <>
                  . Main owner of the most files here:{" "}
                  <Link to={personPath(repoId, summary.topOwner.name)} className="plain-link">
                    <strong>{summary.topOwner.name}</strong>
                  </Link>{" "}
                  ({summary.topOwner.count} of {inFolder.length})
                </>
              )}
            </p>
          </div>

          <div className="risk-table-wrapper">
            <table className="risk-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="col-mix">Risk mix</th>
                  <th scope="col" className="col-number">High-risk</th>
                  <th scope="col">Main owner</th>
                </tr>
              </thead>
              <tbody>
                {contents.folders.map((folder) => (
                  <tr key={folder.path}>
                    <th scope="row">
                      <Link to={folderPath(repoId, folder.path)} className="entry-link">
                        <Icon name="folder" />
                        {folder.name}
                        <span className="entry-link__count">{folder.files.length}</span>
                      </Link>
                    </th>
                    <td className="col-mix">
                      <RiskMix files={folder.files} thin />
                    </td>
                    <td className="col-number">
                      <span className={folder.highCount > 0 ? "risk--high risk-text" : "text-muted"}>
                        {folder.highCount}
                      </span>
                    </td>
                    <td>
                      {folder.topOwner && (
                        <Link to={personPath(repoId, folder.topOwner.name)} className="person-chip plain-link">
                          <Avatar name={folder.topOwner.name} size={22} />
                          {folder.topOwner.name}
                          <span className="text-muted">
                            {formatPercent(folder.topOwner.count / folder.files.length)}
                          </span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {contents.files.map((file) => {
                  const level = getRiskLevel(file.riskScore);
                  return (
                    <tr key={file.path}>
                      <th scope="row">
                        <Link to={filePath(repoId, file.path)} className="entry-link entry-link--file">
                          <Icon name="file" />
                          {baseName(file.path)}
                        </Link>
                      </th>
                      <td className="col-mix">
                        <ShareBar
                          share={file.topAuthorShare}
                          level={level.name === "low" ? undefined : level.name}
                        />
                      </td>
                      <td className="col-number">
                        <RiskBadge level={level} />
                      </td>
                      <td>
                        <Link to={personPath(repoId, file.topAuthor)} className="person-chip plain-link">
                          <Avatar name={file.topAuthor} size={22} />
                          {file.topAuthor}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="dashboard__count">
            Folders show how many of their files are at each risk level; files show the
            main owner's share.
          </p>
        </>
      )}
    </section>
  );
}
