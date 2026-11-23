// Standard vs custom commit window for coupling (ingest or recompute).
import {
  COUPLING_WINDOW_MODES,
  DEFAULT_COUPLING_MAX_COMMITS,
} from "../../services/couplingWindow.js";
import "./couplingWindow.css";

export default function CouplingWindowFields({
  idPrefix,
  mode,
  onModeChange,
  maxCommits,
  onMaxCommitsChange,
  since,
  onSinceChange,
  disabled = false,
}) {
  const standardId = `${idPrefix}-window-standard`;
  const customId = `${idPrefix}-window-custom`;
  const maxId = `${idPrefix}-max-commits`;
  const sinceId = `${idPrefix}-since`;
  const isCustom = mode === COUPLING_WINDOW_MODES.custom;

  return (
    <fieldset className="coupling-window" disabled={disabled}>
      <legend className="coupling-window__legend">Coupling history window</legend>
      <p className="coupling-window__hint">
        Limits how much commit history is used to find files that change together.
      </p>

      <div className="coupling-window__modes" role="radiogroup" aria-label="Coupling history window">
        <label className="coupling-window__mode" htmlFor={standardId}>
          <input
            id={standardId}
            type="radio"
            name={`${idPrefix}-window-mode`}
            value={COUPLING_WINDOW_MODES.standard}
            checked={!isCustom}
            onChange={() => onModeChange(COUPLING_WINDOW_MODES.standard)}
          />
          <span>
            <span className="coupling-window__mode-title">Standard</span>
            <span className="coupling-window__mode-detail">
              Last {DEFAULT_COUPLING_MAX_COMMITS.toLocaleString()} commits
            </span>
          </span>
        </label>

        <label className="coupling-window__mode" htmlFor={customId}>
          <input
            id={customId}
            type="radio"
            name={`${idPrefix}-window-mode`}
            value={COUPLING_WINDOW_MODES.custom}
            checked={isCustom}
            onChange={() => onModeChange(COUPLING_WINDOW_MODES.custom)}
          />
          <span>
            <span className="coupling-window__mode-title">Custom</span>
            <span className="coupling-window__mode-detail">
              Choose a commit count and/or start date
            </span>
          </span>
        </label>
      </div>

      {isCustom && (
        <div className="coupling-window__custom">
          <label className="coupling-window__field" htmlFor={maxId}>
            <span>Max commits</span>
            <input
              id={maxId}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="All history"
              value={maxCommits}
              onChange={(event) => onMaxCommitsChange(event.target.value)}
            />
            <span className="coupling-window__field-hint">Leave blank to use every commit.</span>
          </label>

          <label className="coupling-window__field" htmlFor={sinceId}>
            <span>Only commits since</span>
            <input
              id={sinceId}
              type="date"
              value={since}
              onChange={(event) => onSinceChange(event.target.value)}
            />
            <span className="coupling-window__field-hint">Optional. Newest commits still preferred.</span>
          </label>
        </div>
      )}
    </fieldset>
  );
}
