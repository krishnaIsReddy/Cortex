// URL builders for every page, so links are written in one place.
//
// Page URLs:
//   /                                  -> redirects to the newest repo
//   /repositories                      -> every analyzed repo + "Analyze a repo"
//   /scoring                           -> how risk is scored
//   /repos/<id>                        -> repo Overview tab
//   /repos/<id>/files                  -> Files tab (?q=search&level=high)
//   /repos/<id>/files/<file path>      -> one file's drill-down
//   /repos/<id>/folders?path=src/api   -> folder browser (risk per folder)
//   /repos/<id>/people                 -> People tab
//   /repos/<id>/people/<name>          -> one person's files
//   /repos/<id>/coupling               -> files that change together
//   /repos/<id>/history                -> risk over time
//
// Note: the backend's POST /repos is proxied by exact match in vite.config.js,
// so these page URLs don't collide with it.

export const REPOSITORIES_PATH = "/repositories";
export const SCORING_PATH = "/scoring";

// The sections under a repo, in display order. `segment` is the URL part
// after the repo id ("" = Overview); `icon` is a name from Icon.jsx.
export const REPO_TABS = [
  { segment: "", label: "Overview", icon: "overview" },
  { segment: "files", label: "Files", icon: "file" },
  { segment: "folders", label: "Folders", icon: "folder" },
  { segment: "people", label: "People", icon: "people" },
  { segment: "coupling", label: "Coupling", icon: "coupling" },
  { segment: "history", label: "History", icon: "history" },
];

// e.g. repoPath("abc", "files") -> "/repos/abc/files"
export function repoPath(repoId, segment = "") {
  return `/repos/${encodeURIComponent(repoId)}${segment ? `/${segment}` : ""}`;
}

// e.g. filePath("abc", "src/api/auth.py") -> "/repos/abc/files/src/api/auth.py"
// Each folder name is encoded on its own so the "/" separators stay readable.
export function filePath(repoId, path) {
  return `${repoPath(repoId, "files")}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// e.g. personPath("abc", "Krishna Reddy") -> "/repos/abc/people/Krishna%20Reddy"
export function personPath(repoId, name) {
  return `${repoPath(repoId, "people")}/${encodeURIComponent(name)}`;
}

// e.g. folderPath("abc", "src/api") -> "/repos/abc/folders?path=src%2Fapi"
// The repo root ("") is the Folders tab with no query.
export function folderPath(repoId, dir = "") {
  const base = repoPath(repoId, "folders");
  return dir ? `${base}?${new URLSearchParams({ path: dir })}` : base;
}
