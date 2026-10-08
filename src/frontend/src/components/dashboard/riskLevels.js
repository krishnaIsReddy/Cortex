// Single source of truth for how a risk score maps to a risk level.
//
// ASSUMPTION (v1): riskScore is a number from 0 to 1, where higher = riskier
// (currently the top author's share of the file). If the scoring service (#4)
// ends up using a different scale, only this file should need to change.
//
// Colors for each level live in dashboard.css, keyed by `name`
// (e.g. name "high" -> CSS class "risk--high").

// Levels are ordered from highest to lowest threshold.
// A score belongs to the first level whose `min` it meets or exceeds.
export const RISK_LEVELS = [
  { name: "high", label: "High", min: 0.7 },
  { name: "medium", label: "Medium", min: 0.4 },
  { name: "low", label: "Low", min: 0 },
];

// Returns the risk level object for a score, e.g. getRiskLevel(0.85) -> High.
// Scores below 0 (or invalid) fall back to the lowest level.
export function getRiskLevel(score) {
  const level = RISK_LEVELS.find((level) => score >= level.min);
  return level ?? RISK_LEVELS[RISK_LEVELS.length - 1];
}

// Returns the CSS class that applies a level's colors, e.g. "risk--high".
export function riskClassName(level) {
  return `risk--${level.name}`;
}
