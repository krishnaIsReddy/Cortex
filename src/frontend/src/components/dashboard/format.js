// Small text-formatting helpers shared by the dashboard components.

// Formats a 0-1 share as a whole percentage, e.g. 0.94 -> "94%".
export function formatPercent(share) {
  return `${Math.round(share * 100)}%`;
}

// Returns "1 file" / "15 files", with the number formatted for the locale.
export function pluralize(count, singular) {
  return `${count.toLocaleString()} ${singular}${count === 1 ? "" : "s"}`;
}
