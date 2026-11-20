// A thin horizontal bar for a 0-1 share, with its percentage (or a custom
// label) beside it. Neutral grey unless `level` is given ("high"/"medium"),
// so only risky shares take a risk color.
import "./viz.css";
import { formatPercent } from "../dashboard/format.js";

export default function ShareBar({ share, label, level }) {
  const clamped = Math.max(0, Math.min(1, share));
  return (
    <span className={`share-bar${level ? ` risk--${level}` : ""}`}>
      <span className="share-bar__track" aria-hidden="true">
        <span className="share-bar__fill" style={{ display: "block", width: `${clamped * 100}%` }} />
      </span>
      <span className="share-bar__label">{label ?? formatPercent(share)}</span>
    </span>
  );
}
