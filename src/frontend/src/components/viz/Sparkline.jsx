// A tiny line chart of 0-1 values (e.g. share of high-risk files per month).
// Decorative: callers state the numbers in text next to it.
import "./viz.css";

const WIDTH = 100;
const HEIGHT = 32;

export default function Sparkline({ values }) {
  if (values.length < 2) return null;

  // Scale to the data's own range (padded), so small changes are visible.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 0.01);
  const low = min - pad;
  const range = max + pad - low;

  const points = values.map((value, index) => [
    (index / (values.length - 1)) * WIDTH,
    HEIGHT - ((value - low) / range) * HEIGHT,
  ]);
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `0,${HEIGHT} ${line} ${WIDTH},${HEIGHT}`;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <polygon className="sparkline__area" points={area} />
      <polyline className="sparkline__line" points={line} />
    </svg>
  );
}
