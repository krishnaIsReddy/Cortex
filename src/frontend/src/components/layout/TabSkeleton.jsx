// Grey placeholder rows that pulse while a tab's data loads (static if the
// user prefers reduced motion; see dashboard.css).
const DEFAULT_ROW_COUNT = 6;

export default function TabSkeleton({ label = "Loading", rows = DEFAULT_ROW_COUNT }) {
  return (
    <div className="risk-table-wrapper" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}
