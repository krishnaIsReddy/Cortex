// React hook that tracks who is signed in with GitHub.
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../services/authApi.js";

// Returns { user, loading, signOut }:
//   user    - { github_login, avatar_url, ... } or null if not signed in
//   loading - true while the sign-in status is being checked
//   signOut - call to sign out (clears the session, then sets user to null)
export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ignore the result if the component unmounts before the request finishes.
    let ignore = false;

    getCurrentUser()
      .then((result) => {
        if (!ignore) setUser(result);
      })
      .catch((err) => {
        // Treat as signed out, but log it so a broken backend isn't silent.
        console.warn("useCurrentUser: could not check sign-in status", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const signOut = async () => {
    try {
      await logout();
      setUser(null);
    } catch (err) {
      console.error("useCurrentUser: sign out failed", err);
    }
  };

  return { user, loading, signOut };
}
