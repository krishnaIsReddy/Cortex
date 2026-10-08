// API client for risk data. This is the ONLY place the frontend gets
// risk data from, so switching from mock data to the real API happens here.
import { sampleReports } from "./mockData/index.js";

// Fake network delay so the loading state is visible during development.
const MOCK_DELAY_MS = 500;

// Returns a Promise of the risk report for a repo: { repo, files }.
// See mockData/index.js for the fields of each part. `files` is unsorted.
// Rejects with an Error if there is no report for the repo.
//
// TODO: replace the mock with the real request once the scoring API (#4) exists:
//   const response = await fetch(`/api/repos/${repoId}/risk-report`);
//   if (!response.ok) throw new Error(`Failed to load risk report (HTTP ${response.status})`);
//   return response.json();
export async function getRiskReport(repoId) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

  const report = sampleReports[repoId];
  if (!report) {
    throw new Error(`No risk report found for repository "${repoId}".`);
  }

  // Return copies so callers can sort/modify them without changing the mock data.
  return { repo: { ...report.repo }, files: [...report.files] };
}
