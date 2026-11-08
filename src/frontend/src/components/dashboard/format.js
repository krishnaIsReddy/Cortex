// Small text-formatting helpers shared by the dashboard components.

// Formats a 0-1 share as a whole percentage, e.g. 0.94 -> "94%".
export function formatPercent(share) {
  return `${Math.round(share * 100)}%`;
}

// Returns "1 file" / "15 files", with the number formatted for the locale.
export function pluralize(count, singular) {
  return `${count.toLocaleString()} ${singular}${count === 1 ? "" : "s"}`;
}

// A file nobody has changed in this long is flagged as stale: whoever wrote
// it may not remember it, even if the risk score looks fine.
export const STALE_AFTER_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days between an ISO timestamp and now.
function daysSince(isoString) {
  return Math.floor((Date.now() - new Date(isoString).getTime()) / MS_PER_DAY);
}

// True if the timestamp is older than STALE_AFTER_DAYS.
export function isStale(isoString) {
  return daysSince(isoString) > STALE_AFTER_DAYS;
}

// Formats an ISO timestamp as a date for the viewer's locale, e.g. "Oct 7, 2026".
export function formatDate(isoString) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(isoString)
  );
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

// Formats an ISO timestamp relative to now, e.g. "yesterday", "3 months ago".
export function formatRelative(isoString) {
  const days = daysSince(isoString);
  if (days < 30) return relativeTime.format(-days, "day");
  if (days < 365) return relativeTime.format(-Math.floor(days / 30), "month");
  return relativeTime.format(-Math.floor(days / 365), "year");
}
