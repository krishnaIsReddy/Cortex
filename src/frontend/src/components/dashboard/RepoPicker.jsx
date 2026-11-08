// Dropdown for choosing which repo the dashboard shows: repos ingested by the
// backend ("Live repos") plus the built-in sample datasets.
import { sampleRepoOptions } from "../../services/mockData/index.js";

export default function RepoPicker({ value, onChange, liveRepos, liveLoading, liveError }) {
  // Explains an empty "Live repos" group, so it's clear why nothing is listed.
  let liveStatus = null;
  if (liveLoading) liveStatus = "Loading…";
  else if (liveError) liveStatus = "Unavailable (is the backend running?)";
  else if (liveRepos.length === 0) liveStatus = "None ingested yet";

  return (
    <label className="repo-picker">
      <span className="repo-picker__label">Repository</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <optgroup label="Live repos">
          {liveStatus ? (
            <option disabled>{liveStatus}</option>
          ) : (
            liveRepos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))
          )}
        </optgroup>

        <optgroup label="Sample data">
          {sampleRepoOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
