// One person's page, at /repos/<id>/people/<name>: what they own, what would
// lose its main owner if they left, and every file they've worked on.
import { Link, useParams } from "react-router";
import RiskBadge from "../../components/dashboard/RiskBadge.jsx";
import { formatDate, formatRelative, pluralize } from "../../components/dashboard/format.js";
import { getRiskLevel } from "../../components/dashboard/riskLevels.js";
import MiniStat from "../../components/layout/MiniStat.jsx";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { filesForPerson } from "../../components/people/people.js";
import Avatar from "../../components/viz/Avatar.jsx";
import RiskMix from "../../components/viz/RiskMix.jsx";
import ShareBar from "../../components/viz/ShareBar.jsx";
import { filePath, personPath, repoPath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

export default function PersonTab() {
  const { repoId, files, people, loading } = useRepoReport();
  const { name } = useParams();

  if (loading) return <TabSkeleton label="Loading person" />;

  const backLink = (
    <Link to={repoPath(repoId, "people")} className="back-link">
      ← All people
    </Link>
  );

  const person = people.find((p) => p.name === name);
  if (!person) {
    return (
      <section className="tab-panel">
        {backLink}
        <p className="state-message">No author named "{name}" in this repository.</p>
      </section>
    );
  }

  const highRiskCount = person.highRiskFiles.length;
  const rank = people.indexOf(person) + 1;

  return (
    <section className="tab-panel" aria-labelledby="person-title">
      {backLink}

      <header className="person-header">
        <Avatar name={person.name} size={56} />
        <div className="person-header__text">
          <h2 id="person-title" className="dashboard__title person-header__name">{person.name}</h2>
          <p className="text-muted">
            #{rank} of {pluralize(people.length, "person", "people")} by exposure
            {person.lastActiveAt && (
              <>
                {" "}· last commit{" "}
                <time dateTime={person.lastActiveAt}>{formatRelative(person.lastActiveAt)}</time>
              </>
            )}
          </p>
        </div>
      </header>

      <ul className="stat-grid stat-grid--compact" aria-label={`${person.name} at a glance`}>
        <MiniStat
          label="High-risk files owned"
          value={highRiskCount}
          detail="would lose their main owner"
          risky={highRiskCount > 0}
        />
        <MiniStat label="Main owner of" value={person.ownedFiles.length} detail={`of ${pluralize(files.length, "file")}`} />
        <MiniStat label="Worked on" value={person.touchedFiles.length} detail="files with any share" />
        <MiniStat
          label="Last active"
          value={person.lastActiveAt ? formatDate(person.lastActiveAt) : "—"}
          detail="latest commit to any file"
          small
        />
      </ul>

      {person.ownedFiles.length > 0 && (
        <div className="overview__panel">
          <h3 className="overview__heading">Risk of the files they own</h3>
          <RiskMix files={person.ownedFiles} legend />
        </div>
      )}

      {highRiskCount > 0 && (
        <p className="file-detail__note risk--high">
          If {person.name} left, {pluralize(highRiskCount, "high-risk file")} would lose the
          person who knows {highRiskCount === 1 ? "it" : "them"} best. Pairing someone else
          with {person.name} on these is the quickest way to lower the risk.
        </p>
      )}

      <div className="risk-table-wrapper">
        <table className="risk-table">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Risk</th>
              <th scope="col" className="col-mix">Their current share</th>
              <th scope="col" className="col-number">All-time share</th>
              <th scope="col">Main owner</th>
            </tr>
          </thead>
          <tbody>
            {filesForPerson(files, person.name).map(({ file, share, historicalShare, isOwner }) => (
              <tr key={file.path}>
                <td className="file-path">
                  <Link to={filePath(repoId, file.path)} className="file-link">
                    {file.path}
                  </Link>
                </td>
                <td>
                  <RiskBadge level={getRiskLevel(file.riskScore)} />
                </td>
                <td className="col-mix">
                  <ShareBar share={share} />
                </td>
                <td className="col-number text-muted">{Math.round(historicalShare * 100)}%</td>
                <td>
                  {isOwner ? (
                    // Same chip shape as the other rows (so the column lines
                    // up), but not a link: it's this page.
                    <span className="person-chip text-muted">
                      <Avatar name={person.name} size={22} />
                      {person.name}
                    </span>
                  ) : (
                    <Link to={personPath(repoId, file.topAuthor)} className="person-chip plain-link">
                      <Avatar name={file.topAuthor} size={22} />
                      {file.topAuthor}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
