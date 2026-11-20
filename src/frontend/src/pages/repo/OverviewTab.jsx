// Overview (the repo's landing page): headline numbers with small charts,
// then panels for where the risk sits (folders), who holds it (people), the
// riskiest files, and owners who've gone quiet. Each links on to the section
// with the full detail.
import { Link } from "react-router";
import RiskBadge from "../../components/dashboard/RiskBadge.jsx";
import {
  formatDate,
  formatPercent,
  isStale,
  pluralize,
} from "../../components/dashboard/format.js";
import { getRiskLevel } from "../../components/dashboard/riskLevels.js";
import { describeChange, formatMonth } from "../../components/dashboard/trendSummary.js";
import { baseName, listFolder, summarizeFiles } from "../../components/folders/folders.js";
import Icon from "../../components/layout/Icon.jsx";
import TabSkeleton from "../../components/layout/TabSkeleton.jsx";
import { busFactor } from "../../components/people/people.js";
import Avatar from "../../components/viz/Avatar.jsx";
import RiskMix from "../../components/viz/RiskMix.jsx";
import ShareBar from "../../components/viz/ShareBar.jsx";
import Sparkline from "../../components/viz/Sparkline.jsx";
import { useRiskTrend } from "../../hooks/useRiskTrend.js";
import { filePath, folderPath, personPath, repoPath } from "../../routes.js";
import { useRepoReport } from "./useRepoReport.js";

// How many rows each panel shows before "All … →".
const LIST_LENGTH = 5;

// A bus factor this low means one or two departures would orphan most code.
const RISKY_BUS_FACTOR = 2;

const isHighRisk = (file) => getRiskLevel(file.riskScore).name === "high";

export default function OverviewTab() {
  const { repoId, files, people, loading } = useRepoReport();

  if (loading) return <TabSkeleton label="Loading overview" rows={4} />;

  if (files.length === 0) {
    return (
      <p className="state-message">
        Nothing to summarize yet. Once this repository's history is analyzed, its
        riskiest files and people appear here.
      </p>
    );
  }

  const highRiskFiles = files.filter(isHighRisk);
  const staleFiles = files.filter((file) => file.lastChangedAt && isStale(file.lastChangedAt));
  const bus = busFactor(files, people);
  const owners = people.filter((person) => person.ownedFiles.length > 0);
  const rootListing = listFolder(files, "");
  const topFolders = rootListing.folders.slice(0, LIST_LENGTH);
  // Files directly in the repo root, shown as one more row so every file is counted.
  const rootFiles = summarizeFiles(rootListing.files);
  const riskiestFiles = [...files].sort((a, b) => b.riskScore - a.riskScore).slice(0, LIST_LENGTH);
  // Owners of high-risk files who haven't committed anywhere in over a year.
  const quietOwners = people.filter(
    (person) => person.highRiskFiles.length > 0 && person.lastActiveAt && isStale(person.lastActiveAt)
  );
  const hasActivityDates = people.some((person) => person.lastActiveAt);
  // `people` is sorted by high-risk files first, so the biggest owner isn't
  // necessarily owners[0]; bars are scaled to whoever owns the most.
  const maxOwned = Math.max(1, ...owners.map((person) => person.ownedFiles.length));

  return (
    <div className="overview">
      <ul className="stat-grid" aria-label="Key numbers">
        <Stat
          to={repoPath(repoId, "people")}
          label="Bus factor"
          value={bus.count}
          risky={bus.count <= RISKY_BUS_FACTOR}
          detail={
            bus.count === 1
              ? `${bus.names[0]} owns over half the files`
              : `${pluralize(bus.count, "person", "people")} own over half the files`
          }
        />
        <Stat
          to={`${repoPath(repoId, "files")}?level=high`}
          label="High-risk files"
          value={highRiskFiles.length}
          risky={highRiskFiles.length > 0}
          detail={`${formatPercent(highRiskFiles.length / files.length)} of ${pluralize(files.length, "file")}`}
        >
          <RiskMix files={files} thin />
        </Stat>
        <TrendStat repoId={repoId} />
        <Stat
          to={repoPath(repoId, "files")}
          label="Stale files"
          value={staleFiles.length}
          detail="unchanged for over a year"
        >
          <ShareBar share={staleFiles.length / files.length} />
        </Stat>
      </ul>

      <div className="overview__columns">
        <Panel
          title="Risk by folder"
          icon="folder"
          more={{ to: folderPath(repoId), label: "Browse folders" }}
        >
          <RiskMix files={files} legend />
          {topFolders.length === 0 ? (
            <p className="text-muted">Every file is in the top folder of the repository.</p>
          ) : (
            <ul className="link-list">
              {[
                ...topFolders,
                ...(rootFiles.files.length > 0
                  ? [{ ...rootFiles, name: "Top-level files", path: "", isRoot: true }]
                  : []),
              ].map((folder) => (
                <li key={folder.path} className="folder-row">
                  <Link to={folderPath(repoId, folder.path)} className="link-list__path folder-row__name">
                    {folder.isRoot ? <span className="folder-row__root">{folder.name}</span> : `${folder.name}/`}
                  </Link>
                  <span className="folder-row__mix">
                    <RiskMix files={folder.files} thin />
                  </span>
                  <span className="link-list__meta folder-row__meta">
                    {folder.highCount > 0 ? (
                      <span className="risk--high risk-text">{folder.highCount} high</span>
                    ) : (
                      "0 high"
                    )}{" "}
                    / {folder.files.length}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Who to talk to"
          icon="people"
          more={{ to: repoPath(repoId, "people"), label: `All ${pluralize(people.length, "person", "people")}` }}
        >
          <p className="text-muted overview__hint">Main owners, most high-risk files first.</p>
          <ul className="link-list">
            {owners.slice(0, LIST_LENGTH).map((person) => (
              <li key={person.name} className="person-row">
                <Link to={personPath(repoId, person.name)} className="person-chip link-list__name">
                  <Avatar name={person.name} />
                  <span>{person.name}</span>
                </Link>
                <span className="person-row__bar">
                  <ShareBar
                    share={person.ownedFiles.length / maxOwned}
                    label={pluralize(person.ownedFiles.length, "file")}
                  />
                </span>
                <span className="link-list__meta person-row__meta">
                  {person.highRiskFiles.length > 0 ? (
                    <span className="risk--high risk-text">{person.highRiskFiles.length} high-risk</span>
                  ) : (
                    "no high-risk"
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Riskiest files"
          icon="file"
          more={{ to: repoPath(repoId, "files"), label: `All ${pluralize(files.length, "file")}` }}
        >
          <ul className="link-list">
            {riskiestFiles.map((file) => (
              <li key={file.path} className="file-row">
                <Link to={filePath(repoId, file.path)} className="link-list__path" title={file.path}>
                  <span className="file-row__base">{baseName(file.path)}</span>
                  {file.path.includes("/") && (
                    <span className="file-row__dir">{file.path.slice(0, file.path.lastIndexOf("/"))}</span>
                  )}
                </Link>
                <span className="link-list__meta file-row__owner">
                  <Avatar name={file.topAuthor} size={20} />
                  {formatPercent(file.topAuthorShare)}
                </span>
                <RiskBadge level={getRiskLevel(file.riskScore)} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Owners who've gone quiet" icon="clock">
          <p className="text-muted overview__hint">
            Main owners of high-risk files with no commits in over a year.
          </p>
          {!hasActivityDates ? (
            <p className="text-muted">This dataset has no commit dates.</p>
          ) : quietOwners.length === 0 ? (
            <p className="text-muted">Everyone who owns a high-risk file has committed in the last year.</p>
          ) : (
            <ul className="link-list">
              {quietOwners.slice(0, LIST_LENGTH).map((person) => (
                <li key={person.name} className="quiet-row">
                  <Link to={personPath(repoId, person.name)} className="person-chip link-list__name">
                    <Avatar name={person.name} />
                    <span>{person.name}</span>
                  </Link>
                  <span className="link-list__meta">
                    last commit <time dateTime={person.lastActiveAt}>{formatDate(person.lastActiveAt)}</time>
                  </span>
                  <span className="link-list__meta">
                    <span className="risk--high risk-text">{person.highRiskFiles.length}</span> high-risk
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// One headline number, linking to where it comes from. `risky` colors the
// number with the High risk color; children (a small chart) go under it.
function Stat({ to, label, value, detail, risky = false, children }) {
  return (
    <li>
      <Link to={to} className={`stat${risky ? " risk--high" : ""}`}>
        <span className="stat__label">{label}</span>
        <span className="stat__value">{value}</span>
        {children && <span className="stat__chart">{children}</span>}
        {detail && <span className="stat__detail">{detail}</span>}
      </Link>
    </li>
  );
}

// The headline for which way risk is heading: this month's share of
// high-risk files, a 12-month sparkline, and the change in words.
function TrendStat({ repoId }) {
  const { points, loading, error } = useRiskTrend(repoId, 12);
  const to = repoPath(repoId, "history");

  if (loading || error || points.length < 2) {
    return (
      <Stat
        to={to}
        label="Risk trend"
        value="—"
        detail={loading ? "Loading history…" : "Not enough history yet"}
      />
    );
  }

  const last = points[points.length - 1];
  const { verdict } = describeChange(points);
  return (
    <Stat
      to={to}
      label={`High-risk share, ${formatMonth(last.periodEnd)}`}
      value={formatPercent(last.highRiskShare)}
      detail={`${verdict} over 12 months`}
    >
      <Sparkline values={points.map((point) => point.highRiskShare)} />
    </Stat>
  );
}

// A framed panel with a heading and an optional "more →" link at the bottom.
function Panel({ title, icon, more, children }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="overview__panel" aria-labelledby={id}>
      <h2 id={id} className="overview__heading">
        <Icon name={icon} />
        {title}
      </h2>
      {children}
      {more && (
        <Link to={more.to} className="overview__more">
          {more.label} →
        </Link>
      )}
    </section>
  );
}
