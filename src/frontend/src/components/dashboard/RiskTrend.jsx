import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./riskTrend.css";
import { formatPercent, pluralize } from "./format.js";
import RiskBadge from "./RiskBadge.jsx";
import { RISK_LEVELS, getRiskLevel } from "./riskLevels.js";
import { useRiskTrend } from "../../hooks/useRiskTrend.js";

// The score at which a file counts as high-risk (0.7 in v1).
const HIGH_RISK_MIN = RISK_LEVELS.find((level) => level.name === "high").min;

// SVG attributes can't reliably read CSS variables, so the chart's colors are
// hex copies of the tokens in index.css. Keep them in sync.
const COLORS = {
  line: "#696969", // neutral connector between the dots (3.3:1 on the surface)
  surface: "#161616", // --color-surface
  grid: "#2e2e2e", // --color-border
  text: "#ebebeb", // --color-text
  muted: "#a4a4a4", // --color-text-muted
};

// Each month's dot uses its risk level's color, the same as the file table's
// badges. Hex copies of --risk-color in dashboard.css; keep them in sync.
const LEVEL_COLORS = {
  high: "#ff9189",
  medium: "#f7c56d",
  low: "#a4a4a4",
};

// A month's level comes from its share of high-risk files, using the same
// cutoffs as file scores: e.g. 40% or more of files high-risk -> Medium.
function levelOf(point) {
  return getRiskLevel(point.highRiskShare);
}

// Each level's range of shares, for the legend, e.g. Medium -> { y1: 0.4, y2: 0.7 }.
// Levels are ordered highest first, so the level before is the upper limit.
const LEVEL_RANGES = RISK_LEVELS.map((level, index) => ({
  level,
  y1: level.min,
  y2: index === 0 ? 1 : RISK_LEVELS[index - 1].min,
}));

// Describes a range for the legend, e.g. "70% or more", "40% to 69%", "under 40%".
function describeRange({ y1, y2 }, index) {
  if (index === 0) return `${formatPercent(y1)} or more`;
  if (y1 === 0) return `under ${formatPercent(y2)}`;
  return `${formatPercent(y1)} to ${Math.round(y2 * 100) - 1}%`;
}

// Opacity of the colored fill under the line: strong enough to read the
// color, light enough that the dots stay the brightest marks.
const AREA_OPACITY = 0.22;

const CHART_HEIGHT = 240;

// Time ranges for the switch above the chart; the first is the default.
// `months: null` means the whole history.
const RANGES = [
  { months: 12, label: "12 months" },
  { months: null, label: "All time" },
];

// A change smaller than this (2 percentage points) counts as "about the same".
const STEADY_THRESHOLD = 0.02;

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Formats an ISO date as a month, e.g. "2026-05-31" -> "May 2026". Formatted
// in UTC so timezones behind UTC don't shift it to the previous day.
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
function formatMonth(isoDate) {
  return monthFormat.format(new Date(isoDate));
}

// Compares the first and last month, e.g.
// { verdict: "Getting worse", detail: "High-risk files went from 20% in Nov 2025 to 58% in Oct 2026." }
function describeChange(points) {
  const first = points[0];
  const last = points[points.length - 1];
  const change = last.highRiskShare - first.highRiskShare;
  const from = `${formatPercent(first.highRiskShare)} in ${formatMonth(first.periodEnd)}`;
  const to = `${formatPercent(last.highRiskShare)} in ${formatMonth(last.periodEnd)}`;

  if (Math.abs(change) < STEADY_THRESHOLD) {
    return { verdict: "About the same", detail: `High-risk files were ${from} and ${to}.` };
  }
  return {
    verdict: change > 0 ? "Getting worse" : "Getting better",
    detail: `High-risk files went from ${from} to ${to}.`,
  };
}

export default function RiskTrend({ repoId }) {
  const [months, setMonths] = useState(RANGES[0].months);
  const { points, loading, error, reload } = useRiskTrend(repoId, months);

  // When switching ranges, keep the current chart on screen (dimmed) until the
  // new data arrives, instead of flashing the loading skeleton.
  const refreshing = loading && points.length > 1;

  // Pick what to show based on the hook's state, checked in priority order.
  let content;
  if (loading && !refreshing) {
    content = <div className="risk-trend__skeleton" aria-busy="true" aria-label="Loading risk history" />;
  } else if (error) {
    content = (
      <div className="state-message state-message--error" role="alert">
        <p>Could not load the risk history: {error.message}</p>
        <button type="button" className="button" onClick={reload}>
          Retry
        </button>
      </div>
    );
  } else if (points.length === 0) {
    content = (
      <p className="state-message">
        No commits have been analyzed for this repository yet, so there's no
        history to chart.
      </p>
    );
  } else if (points.length === 1) {
    content = (
      <p className="state-message">
        Not enough history for a trend yet: all {pluralize(points[0].commitCount, "commit")} are
        from {formatMonth(points[0].periodEnd)}. The chart appears once the
        repository has commits in at least two months.
      </p>
    );
  } else {
    content = <TrendChart points={points} refreshing={refreshing} />;
  }

  return (
    <section className="risk-trend" aria-labelledby="risk-trend-title">
      <div className="risk-trend__header">
        <header className="dashboard__header">
          <h2 id="risk-trend-title" className="dashboard__title">Risk over time</h2>
          <p className="dashboard__subtitle">
            Share of files where one author wrote {formatPercent(HIGH_RISK_MIN)} or
            more, at the end of each month up to the latest commit.
          </p>
        </header>

        {/* Only useful once there's a chart to change. */}
        {points.length > 1 && (
          <div className="risk-trend__range" role="group" aria-label="Time range">
            {RANGES.map((range) => (
              <button
                key={range.label}
                type="button"
                aria-pressed={months === range.months}
                onClick={() => setMonths(range.months)}
              >
                {range.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {content}
    </section>
  );
}

// The chart itself: one dot per month in its risk level's color, with the
// area under the line filled in the same colors, blending from month to month.
// The latest value is labeled at the end; a tooltip and a table give every value.
// `refreshing` dims the chart while a different time range loads.
function TrendChart({ points, refreshing }) {
  const { verdict, detail } = describeChange(points);
  const lastIndex = points.length - 1;

  // Ids must be unique on the page; useId() can contain characters that
  // aren't safe inside url(#...), so keep only the safe ones.
  const gradientId = `risk-trend-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <>
      <p className="risk-trend__summary">
        <strong>{verdict}.</strong> {detail}
      </p>

      <div
        className={`risk-trend__chart${refreshing ? " risk-trend__chart--refreshing" : ""}`}
        aria-busy={refreshing}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={points} margin={{ top: 12, right: 48, bottom: 0, left: 0 }}>
            <defs>
              {/* Left-to-right gradient with one color stop per month. Months are
                  evenly spaced from the first to the last, so stop i sits at
                  i / lastIndex of the area's width, right under its dot. */}
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                {points.map((point, index) => (
                  <stop
                    key={point.periodEnd}
                    offset={index / lastIndex}
                    stopColor={LEVEL_COLORS[levelOf(point).name]}
                    stopOpacity={AREA_OPACITY}
                  />
                ))}
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis
              dataKey="periodEnd"
              tickFormatter={formatMonth}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              axisLine={{ stroke: COLORS.grid }}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={formatPercent}
              tick={{ fill: COLORS.muted, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: COLORS.muted, strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              dataKey="highRiskShare"
              name="High-risk files"
              type="linear"
              stroke={COLORS.line}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              // Every month gets a dot in its level's color. The ring in the
              // surface color keeps neighbouring dots and the line apart.
              dot={({ cx, cy, index, payload }) => (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={LEVEL_COLORS[levelOf(payload).name]}
                  stroke={COLORS.surface}
                  strokeWidth={2}
                />
              )}
              activeDot={({ cx, cy, payload }) => (
                <circle
                  cx={cx}
                  cy={cy}
                  r={7}
                  fill={LEVEL_COLORS[levelOf(payload).name]}
                  stroke={COLORS.surface}
                  strokeWidth={2}
                />
              )}
              // Only the latest month gets a value label.
              label={({ x, y, index, value }) =>
                index === lastIndex ? (
                  <text key="end-label" x={x + 12} y={y} dy={4} fill={COLORS.text} fontSize={12} fontWeight={600}>
                    {formatPercent(value)}
                  </text>
                ) : null
              }
              isAnimationActive={!prefersReducedMotion}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* What the dot colors mean (the badges also carry the level as text). */}
      <ul className="risk-trend__legend" aria-label="Dot colors">
        {LEVEL_RANGES.map((range, index) => (
          <li key={range.level.name}>
            <RiskBadge level={range.level} /> {describeRange(range, index)} of files high-risk
          </li>
        ))}
      </ul>

      {/* Every value is also readable without hovering. */}
      <details className="risk-trend__table">
        <summary>Show as table</summary>
        <div className="risk-table-wrapper">
          <table className="risk-table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Level</th>
                <th scope="col" className="col-number">High-risk files</th>
                <th scope="col" className="col-number">Share</th>
                <th scope="col" className="col-number">Commits so far</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.periodEnd}>
                  <td>{formatMonth(point.periodEnd)}</td>
                  <td>
                    <RiskBadge level={levelOf(point)} />
                  </td>
                  <td className="col-number">
                    {point.highRiskFileCount} of {point.fileCount}
                  </td>
                  <td className="col-number">{formatPercent(point.highRiskShare)}</td>
                  <td className="col-number">{point.commitCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

// Tooltip for the hovered (or keyboard-focused) month. Recharts passes
// `active` and `payload`; payload[0].payload is the data point.
function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="risk-trend__tooltip">
      <p className="risk-trend__tooltip-month">{formatMonth(point.periodEnd)}</p>
      <p className="risk-trend__tooltip-row">
        <strong className="risk-trend__tooltip-value">{formatPercent(point.highRiskShare)}</strong>
        high-risk <RiskBadge level={levelOf(point)} />
      </p>
      <p className="risk-trend__tooltip-detail">
        {point.highRiskFileCount} of {pluralize(point.fileCount, "file")} ·{" "}
        {pluralize(point.commitCount, "commit")} so far
      </p>
    </div>
  );
}
