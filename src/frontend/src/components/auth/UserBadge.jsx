// Header control for GitHub sign-in: a "Sign in with GitHub" link when signed
// out, or the user's avatar, username and a "Sign out" button when signed in.
import "./auth.css";
import { LOGIN_URL } from "../../services/authApi.js";

export default function UserBadge({ user, loading, onSignOut }) {
  // Render nothing while checking, so the button doesn't flash on page load.
  if (loading) return null;

  if (!user) {
    return (
      // A plain link (not fetch): the browser must follow the redirects to
      // GitHub and back for the OAuth flow to work.
      <a className="button" href={LOGIN_URL}>
        Sign in with GitHub
      </a>
    );
  }

  return (
    <div className="user-badge">
      {user.avatar_url && (
        <img className="user-badge__avatar" src={user.avatar_url} alt="" width="24" height="24" />
      )}
      <span className="user-badge__login">{user.github_login}</span>
      <button type="button" className="button" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
