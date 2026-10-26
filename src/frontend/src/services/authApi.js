// API client for GitHub sign-in. Talks to the backend's /api/auth routes
// (proxied to the FastAPI server by vite.config.js).

// Navigating here starts the GitHub OAuth flow. The backend redirects to
// GitHub, then back to the frontend once the user has signed in.
export const LOGIN_URL = "/api/auth/github/login";

// Returns a Promise of the signed-in user, or null if nobody is signed in:
//   { github_id, github_login, avatar_url, installation_id }
export async function getCurrentUser() {
  const response = await fetch("/api/auth/me");

  // 401 is the normal "not signed in" answer, not an error.
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Could not check sign-in status (HTTP ${response.status})`);
  }
  return response.json();
}

// Signs the user out by clearing their session on the backend.
export async function logout() {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new Error(`Could not sign out (HTTP ${response.status})`);
  }
}
