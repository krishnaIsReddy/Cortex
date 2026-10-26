// Collapsible "How risk is scored" explanation for first-time viewers.
// The cutoffs are generated from RISK_LEVELS so this text can never drift
// out of sync with how the table actually colors files.
import RiskBadge from "./RiskBadge.jsx";
import { RISK_LEVELS } from "./riskLevels.js";

// Describes a level's score range in words, e.g.
//   High   -> "0.70 and above"
//   Medium -> "0.40 to just under 0.70"
// Levels are ordered highest first, so the level before this one is its upper limit.
function describeRange(level, index) {
  if (index === 0) return `${level.min.toFixed(2)} and above`;
  const upperLimit = RISK_LEVELS[index - 1].min;
  return `${level.min.toFixed(2)} to just under ${upperLimit.toFixed(2)}`;
}

// `halfLifeDays` is scoring's decay half-life (null while the report loads).
export default function RiskExplainer({ halfLifeDays }) {
  return (
    // <details> is a native, keyboard-accessible expand/collapse element.
    <details className="risk-explainer">
      <summary>How risk is scored</summary>

      <div className="risk-explainer__body">
        <p>
          <strong>Bus-factor risk</strong> is the chance that knowledge of a file is
          concentrated in too few people. If that person leaves, nobody else
          understands the code.
        </p>
        <p>
          Cortex reads the repository's git history and works out what share of
          each file was written by each author. A file's <strong>risk score</strong> is
          its top author's share, from 0 to 1: a score of 0.94 means one person
          wrote 94% of the file.
        </p>
        <p>
          Recent work counts for more than old work, because people forget code
          they haven't touched in a while. Each commit's lines are weighted by
          age: a commit {halfLifeDays ?? 180} days older than the newest counts
          half as much. Files nobody has changed in over a year are also
          marked <span className="stale-tag">Stale</span>.
        </p>

        <ul className="risk-explainer__levels">
          {RISK_LEVELS.map((level, index) => (
            <li key={level.name}>
              <RiskBadge level={level} /> {describeRange(level, index)}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
