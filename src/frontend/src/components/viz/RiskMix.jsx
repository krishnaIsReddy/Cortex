// A stacked bar of how many files are High, Medium and Low risk, with an
// optional legend. The legend (or the aria-label) spells out the counts, so
// the colors are never the only way to read it.
import "./viz.css";
import { RISK_LEVELS, getRiskLevel, riskClassName } from "../dashboard/riskLevels.js";
import { pluralize } from "../dashboard/format.js";

// Counts files per level: { high: 3, medium: 5, low: 12 }.
export function countByLevel(files) {
  const counts = Object.fromEntries(RISK_LEVELS.map((level) => [level.name, 0]));
  for (const file of files) counts[getRiskLevel(file.riskScore).name] += 1;
  return counts;
}

export default function RiskMix({ files, legend = false, thin = false }) {
  const counts = countByLevel(files);
  const total = files.length;
  const summary = RISK_LEVELS.map((level) => `${counts[level.name]} ${level.label}`).join(", ");

  return (
    <div className={`risk-mix${thin ? " risk-mix--thin" : ""}`}>
      <div
        className="risk-mix__bar"
        role="img"
        aria-label={`${pluralize(total, "file")}: ${summary}`}
      >
        {total > 0 &&
          RISK_LEVELS.map(
            (level) =>
              counts[level.name] > 0 && (
                <span
                  key={level.name}
                  className={`risk-mix__segment ${riskClassName(level)}`}
                  style={{ width: `${(counts[level.name] / total) * 100}%` }}
                />
              )
          )}
      </div>

      {legend && (
        <ul className="risk-mix__legend" aria-hidden="true">
          {RISK_LEVELS.map((level) => (
            <li key={level.name}>
              <span className={`risk-mix__swatch ${riskClassName(level)}`} />
              {level.label} <strong>{counts[level.name]}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
