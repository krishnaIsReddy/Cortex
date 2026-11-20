// "How scoring works": the reference page for every number in the app.
// Level cutoffs come from RISK_LEVELS and the half-life from the same
// constant the samples use, so this text can't drift from the scoring.
import "../components/dashboard/dashboard.css";
import "../components/layout/layout.css";
import RiskBadge from "../components/dashboard/RiskBadge.jsx";
import { STALE_AFTER_DAYS } from "../components/dashboard/format.js";
import { RISK_LEVELS } from "../components/dashboard/riskLevels.js";
import { SAMPLE_HALF_LIFE_DAYS } from "../services/mockData/index.js";

// Describes a level's score range in words, e.g.
//   High   -> "0.70 and above"
//   Medium -> "0.40 to just under 0.70"
// Levels are ordered highest first, so the level before this one is its upper limit.
function describeRange(level, index) {
  if (index === 0) return `${level.min.toFixed(2)} and above`;
  const upperLimit = RISK_LEVELS[index - 1].min;
  return `${level.min.toFixed(2)} to just under ${upperLimit.toFixed(2)}`;
}

export default function ScoringPage() {
  return (
    <article className="page page--prose">
      <header className="page__header">
        <h1 className="page__title">How scoring works</h1>
        <p className="page__subtitle">
          Every number in Cortex comes from the repository's git history. Nothing
          is self-reported.
        </p>
      </header>

      <section className="page__section">
        <h2 className="dashboard__title">Bus-factor risk</h2>
        <p>
          Bus-factor risk is the chance that knowledge of a file is concentrated in
          too few people. If that person leaves, nobody else understands the code.
        </p>
      </section>

      <section className="page__section">
        <h2 className="dashboard__title">Risk score</h2>
        <p>
          Cortex works out what share of each file was written by each author. A
          file's risk score is its top author's share, from 0 to 1: a score of 0.94
          means one person wrote 94% of the file.
        </p>
        <ul className="scoring-levels">
          {RISK_LEVELS.map((level, index) => (
            <li key={level.name}>
              <RiskBadge level={level} /> {describeRange(level, index)}
            </li>
          ))}
        </ul>
      </section>

      <section className="page__section">
        <h2 className="dashboard__title">Recent work counts for more</h2>
        <p>
          People forget code they haven't touched in a while, so each commit's lines
          are weighted by age: a commit {SAMPLE_HALF_LIFE_DAYS} days older than the
          repository's newest commit counts half as much. A file's drill-down shows
          both this <em>current</em> share and the unweighted <em>all-time</em> share.
        </p>
        <p>
          Files nobody has changed in over {STALE_AFTER_DAYS} days are marked{" "}
          <span className="stale-tag">Stale</span>. Staleness is shown alongside the
          score but doesn't change it.
        </p>
      </section>

      <section className="page__section">
        <h2 className="dashboard__title">People</h2>
        <p>
          A person <em>owns</em> a file when they have its largest current share.
          The People tab ranks authors by how many high-risk files they own: the
          files that would lose the person who knows them best if that author left.
        </p>
      </section>

      <section className="page__section">
        <h2 className="dashboard__title">Coupling</h2>
        <p>
          Two files are coupled when they're usually changed in the same commit. The
          coupling score is the number of commits that touched both, divided by the
          commit count of the busier file. Changing a risky file usually means
          understanding its coupled partners too.
        </p>
      </section>

      <section className="page__section">
        <h2 className="dashboard__title">Risk over time</h2>
        <p>
          The History tab replays the repository month by month and shows the share
          of files that were high-risk at the end of each month.
        </p>
      </section>
    </article>
  );
}
