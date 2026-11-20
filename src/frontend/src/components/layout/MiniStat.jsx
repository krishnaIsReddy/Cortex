// A headline number that isn't a link (the table under it is the detail).
// `risky` colors the number with the High risk color; `small` is for text
// values like dates or names.
export default function MiniStat({ label, value, detail, risky = false, small = false }) {
  return (
    <li className={`stat stat--static${risky ? " risk--high" : ""}`}>
      <span className="stat__label">{label}</span>
      <span className={`stat__value${small ? " stat__value--small" : ""}`}>{value}</span>
      {detail && <span className="stat__detail">{detail}</span>}
    </li>
  );
}
