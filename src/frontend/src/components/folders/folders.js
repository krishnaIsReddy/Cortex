// Groups the risk report's files by folder, for the Folders tab and the
// Overview's "Risk by folder". Pure functions over the report; no fetching.
import { getRiskLevel } from "../dashboard/riskLevels.js";

// What one folder (or any group of files) looks like at a glance:
//   files       - every file in it, at any depth
//   highCount   - how many of them are High risk
//   topOwner    - { name, count }: who is main owner of the most files in it
export function summarizeFiles(files) {
  const ownerCounts = new Map();
  let highCount = 0;
  for (const file of files) {
    if (getRiskLevel(file.riskScore).name === "high") highCount += 1;
    ownerCounts.set(file.topAuthor, (ownerCounts.get(file.topAuthor) ?? 0) + 1);
  }

  let topOwner = null;
  for (const [name, count] of ownerCounts) {
    if (!topOwner || count > topOwner.count) topOwner = { name, count };
  }
  return { files, highCount, topOwner };
}

// The contents of one folder ("" = the repo root):
//   folders - its subfolders, each with summarizeFiles() fields plus
//             { name, path }, riskiest first (most High files, then most files)
//   files   - the files directly inside it, riskiest first
export function listFolder(allFiles, dir) {
  const prefix = dir ? `${dir}/` : "";
  const subfolders = new Map();
  const directFiles = [];

  for (const file of allFiles) {
    if (!file.path.startsWith(prefix)) continue;
    const rest = file.path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) {
      directFiles.push(file);
    } else {
      const name = rest.slice(0, slash);
      if (!subfolders.has(name)) subfolders.set(name, []);
      subfolders.get(name).push(file);
    }
  }

  const folders = [...subfolders]
    .map(([name, files]) => ({ name, path: prefix + name, ...summarizeFiles(files) }))
    .sort(
      (a, b) =>
        b.highCount - a.highCount ||
        b.files.length - a.files.length ||
        a.name.localeCompare(b.name)
    );

  return {
    folders,
    files: directFiles.sort((a, b) => b.riskScore - a.riskScore),
  };
}

// The last part of a path, e.g. "src/api/auth.py" -> "auth.py".
export function baseName(path) {
  return path.slice(path.lastIndexOf("/") + 1);
}
