// API client for repos and risk data. This is the ONLY place the frontend
// gets risk data from, and where repos are sent for ingestion. It serves two
// kinds of repos:
//   - Live repos, ingested by the backend. Their IDs are UUIDs from the API.
//   - Sample datasets (services/mockData/), identified by short names like "cortex".
import { sampleReports } from "./mockData/index.js";

// Fake network delay for sample data so the loading state is visible.
const MOCK_DELAY_MS = 500;

// Live repo IDs are UUIDs, e.g. "08774682-1942-4efc-9931-b3e9deed7ece".
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True if the ID belongs to a repo ingested by the backend (not a sample).
export function isLiveRepoId(repoId) {
  return UUID_PATTERN.test(repoId);
}

// Fetches JSON from the backend (`options` are passed to fetch, e.g. method).
// Throws an Error with the API's message (e.g. "Repository not found") or the
// HTTP status if the request fails. The Error's `status` holds the HTTP status.
async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    throw new Error("Could not reach the Cortex API. Is the backend running?", {
      cause: networkError,
    });
  }

  if (!response.ok) {
    // FastAPI errors look like { "detail": "..." }; fall back to the status code.
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
    const error = new Error(`${detail} (${url})`);
    error.status = response.status;
    throw error;
  }

  // 204 No Content (e.g. after a delete) has no body to parse.
  if (response.status === 204) return null;
  return response.json();
}

// Cleans up a pasted repo URL so the same repo always gets the same URL:
// trims spaces, and removes a trailing "/" or ".git".
// e.g. " https://github.com/owner/repo.git/ " -> "https://github.com/owner/repo"
export function normalizeRepoUrl(url) {
  return url.trim().replace(/\/+$/, "").replace(/\.git$/, "");
}

// Asks the backend to clone and ingest a public GitHub repo. Requires the user
// to be signed in. Slow for big repos: the request lasts until ingestion ends.
// Returns a Promise of { status, url }.
export function ingestRepo(url) {
  return fetchJson("/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

// Returns a Promise of the repos ingested by the backend, newest first:
// [{ id, name, url, analyzedAt }].
export function listLiveRepos() {
  return fetchJson("/api/repos");
}

// Deletes a live repo and its ingested history from the backend.
// Requires the user to be signed in.
export function removeRepo(repoId) {
  return fetchJson(`/api/repos/${repoId}`, { method: "DELETE" });
}

// Returns a Promise of the risk report for a repo: { repo, files }.
// See mockData/index.js for the fields of each part.
// Rejects with an Error if there is no report for the repo.
export async function getRiskReport(repoId) {
  if (isLiveRepoId(repoId)) {
    return fetchJson(`/api/repos/${repoId}/risk-report`);
  }

  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  const report = sampleReports[repoId];
  if (!report) {
    throw new Error(`No risk report found for repository "${repoId}".`);
  }

  // Return copies so callers can sort/modify them without changing the mock data.
  return { repo: { ...report.repo }, files: [...report.files] };
}
