// API client for risk data. This is the ONLY place the frontend gets
// risk data from, so switching from mock data to the real API happens here.
import { sampleReports } from "./mockData/index.js";

// Fake network delay so the loading state is visible during development.
const MOCK_DELAY_MS = 500;

// Live repo IDs are UUIDs, e.g. "08774682-1942-4efc-9931-b3e9deed7ece".
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// True if the ID belongs to a repo ingested by the backend (not a sample).
export function isLiveRepoId(repoId) {
  return UUID_PATTERN.test(repoId);
}

// Fetches JSON from the backend (`options` are passed to fetch, e.g. method).
// Throws an Error with the API's message or the HTTP status if the request fails.
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
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
    const error = new Error(`${detail} (${url})`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

// Returns a Promise of the risk report for a repo: { repo, files }.
// See mockData/index.js for the fields of each part. `files` is unsorted.
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

// Returns a Promise of { status, couplings } for a live repo.
//   status     - "pending" | "ready" | "failed"
//   couplings  - file pairs (empty while pending/failed)
// Sample repos have no coupling data, so they report ready with an empty list.
export async function getCouplings(repoId) {
  if (!isLiveRepoId(repoId)) {
    return { status: "ready", couplings: [] };
  }
  return fetchJson(`/api/repos/${repoId}/couplings`);
}
