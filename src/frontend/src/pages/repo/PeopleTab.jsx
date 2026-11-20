// People tab: one row per author, most exposed first. Answers "who would we
// miss most?": how many high-risk files each person is the main owner of.
// People who own no files are hidden until asked for (?all=1), since in most
// repos they're a long tail of one-off contributors.
import { Link, useSearchParams } from "react-router";
import { formatDate, formatPercent, pluralize } from "../../components/dashboard/format.js";
import MiniStat from "../../components/layout/MiniStat.jsx";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { busFactor } from "../../components/people/people.js";
import Avatar from "../../components/viz/Avatar.jsx";
import ShareBar from "../../components/viz/ShareBar.jsx";
import { personPath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

export default function PeopleTab() {
  const { repoId, files, people, loading } = useRepoReport();
  const [searchParams, setSearchParams] = useSearchParams();
  const showAll = searchParams.get("all") === "1";

  if (loading) return <TabSkeleton label="Loading people" />;

  if (people.length === 0) {
    return (
      <p className="state-message">
        No authors yet. Once the repository's history is analyzed, everyone who
        wrote code in it appears here.
      </p>
    );
  }

  const owners = people.filter((person) => person.ownedFiles.length > 0);
  const exposedCount = people.filter((person) => person.highRiskFiles.length > 0).length;
  const nonOwnerCount = people.length - owners.length;
  const bus = busFactor(files, people);
  const visiblePeople = showAll ? people : owners;

  const toggleAll = () =>
    setSearchParams(showAll ? {} : { all: "1" }, { replace: true });

  return (
    <section className="tab-panel" aria-labelledby="people-title">
      <header className="dashboard__header">
        <h2 id="people-title" className="dashboard__title">People</h2>
        <p className="dashboard__subtitle">
          Everyone who wrote the current code, most exposed first: the people
          whose leaving would orphan the most high-risk files.
        </p>
      </header>

      <ul className="stat-grid stat-grid--compact" aria-label="People at a glance">
        <MiniStat
          label="Bus factor"
          value={bus.count}
          detail={
            bus.count === 1
              ? `${bus.names[0]} owns over half the files`
              : "people own over half the files"
          }
          risky={bus.count <= 2}
        />
        <MiniStat
          label="Hold high-risk files"
          value={exposedCount}
          detail="main owner of at least one"
          risky={exposedCount > 0}
        />
        <MiniStat label="Own at least one file" value={owners.length} detail={`of ${pluralize(people.length, "author")}`} />
        <MiniStat label="Contributed, own nothing" value={nonOwnerCount} detail="smaller shares only" />
      </ul>

      <div className="risk-table-wrapper">
        <table className="risk-table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col" className="col-number">High-risk owned</th>
              <th scope="col" className="col-mix">Share of files owned</th>
              <th scope="col" className="col-number">Worked on</th>
              <th scope="col">Last active</th>
            </tr>
          </thead>
          <tbody>
            {visiblePeople.map((person) => (
              <tr key={person.name}>
                <th scope="row" className="author-name">
                  <Link to={personPath(repoId, person.name)} className="person-chip">
                    <Avatar name={person.name} />
                    {person.name}
                  </Link>
                </th>
                <td className="col-number">
                  {/* The one column that carries risk color, and only when non-zero. */}
                  <span className={person.highRiskFiles.length > 0 ? "risk--high risk-text" : "text-muted"}>
                    {person.highRiskFiles.length}
                  </span>
                </td>
                <td className="col-mix">
                  <ShareBar
                    share={person.ownedFiles.length / files.length}
                    label={`${person.ownedFiles.length} · ${formatPercent(person.ownedFiles.length / files.length)}`}
                  />
                </td>
                <td className="col-number">{person.touchedFiles.length}</td>
                <td className="col-nowrap text-muted">
                  {person.lastActiveAt ? (
                    <time dateTime={person.lastActiveAt}>{formatDate(person.lastActiveAt)}</time>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <p className="dashboard__count">
          Showing {visiblePeople.length} of {pluralize(people.length, "person", "people")}.
          "Owned" means they have the largest recency-weighted share of the file.
        </p>
        {nonOwnerCount > 0 && (
          <button type="button" className="button button--small" onClick={toggleAll}>
            {showAll ? "Only people who own files" : `Show all ${people.length} contributors`}
          </button>
        )}
      </div>
    </section>
  );
}
