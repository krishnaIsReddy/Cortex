// A round initials avatar for a commit author. The tint is picked from the
// name, so the same person has the same color on every page. Decorative:
// the name is always shown next to it.
import "./viz.css";

// "Jonathan Hartley" -> "JH", "hoefling" -> "HO".
function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// A stable hue (0-359) from the name's characters.
function hueFor(name) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) % 360;
  return hash;
}

export default function Avatar({ name, size = 28 }) {
  return (
    <span
      className="avatar"
      style={{ "--avatar-size": `${size}px`, "--avatar-hue": hueFor(name) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
