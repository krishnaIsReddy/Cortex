// Small colored label showing a risk level (High / Medium / Low).
// The text label is always shown so risk never depends on color alone.
import { riskClassName } from "./riskLevels.js";

export default function RiskBadge({ level }) {
  return <span className={`risk-badge ${riskClassName(level)}`}>{level.label}</span>;
}
