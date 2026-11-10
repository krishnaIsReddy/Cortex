// Vite build/dev-server configuration for the Cortex frontend.
// The React plugin enables JSX and fast refresh during development.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Where the FastAPI backend runs during development.
const API_URL = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api requests to the backend, so the browser talks to one origin
    // (no CORS setup needed, and the OAuth login/callback session cookie is
    // set and read on the same host — see GITHUB_CALLBACK_URL).
    proxy: {
      "/api": API_URL,
      // Repo ingestion (POST /repos) isn't under /api yet.
      "/repos": API_URL,
    },
  },
});
