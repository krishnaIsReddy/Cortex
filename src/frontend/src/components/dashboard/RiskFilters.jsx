// Controls for narrowing the file list: a path search box and one toggle
// button per risk level showing how many files are at that level.
// The level buttons use the same colors as the table, so they double as the legend.
import { RISK_LEVELS, getRiskLevel, riskClassName } from "./riskLevels.js";

export default function RiskFilters({
  files,
  query,
  onQueryChange,
  selectedLevel,
  onSelectedLevelChange,
}) {
  // Clicking the selected level again clears the level filter.
  const toggleLevel = (levelName) => {
    onSelectedLevelChange(selectedLevel === levelName ? null : levelName);
  };

  return (
    <div className="risk-filters">
      <label className="risk-filters__search">
        <span className="visually-hidden">Search files</span>
        <input
          type="search"
          placeholder="Search file paths…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="risk-filters__levels" role="group" aria-label="Filter by risk level">
        {RISK_LEVELS.map((level) => {
          // Counts always use the full list so they don't change while filtering.
          const count = files.filter(
            (file) => getRiskLevel(file.riskScore).name === level.name
          ).length;

          return (
            <button
              key={level.name}
              type="button"
              className={`risk-badge risk-filter ${riskClassName(level)}`}
              aria-pressed={selectedLevel === level.name}
              onClick={() => toggleLevel(level.name)}
            >
              {count} {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
