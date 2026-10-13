// Dropdown for switching between sample datasets while the real repo
// connection (#1) isn't ready. Remove once real repos are available.
import { sampleRepoOptions } from "../../services/mockData/index.js";

export default function SampleRepoPicker({ value, onChange }) {
  return (
    <label className="sample-picker">
      <span className="sample-picker__label">Sample dataset</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {sampleRepoOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
