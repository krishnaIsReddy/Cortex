// Text helpers for risk history, shared by the History chart (RiskTrend.jsx)
// and the Overview tab's one-line summary.
import { formatPercent } from "./format.js";

// A change smaller than this (2 percentage points) counts as "about the same".
const STEADY_THRESHOLD = 0.02;

// Formats an ISO date as a month, e.g. "2026-05-31" -> "May 2026". Formatted
// in UTC so timezones behind UTC don't shift it to the previous day.
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export function formatMonth(isoDate) {
  return monthFormat.format(new Date(isoDate));
}

// Compares the first and last month, e.g.
// { verdict: "Getting worse", detail: "High-risk files went from 20% in Nov 2025 to 58% in Oct 2026." }
export function describeChange(points) {
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
