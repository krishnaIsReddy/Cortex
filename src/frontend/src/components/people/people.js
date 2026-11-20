// Builds the People tab's data from the risk report: one entry per author,
// worked out from every file's author list. Pure functions, no fetching, so
// the People tab needs no extra backend endpoint.
import { getRiskLevel } from "../dashboard/riskLevels.js";

// Returns one entry per author, most exposed first:
//   name           - display name (same as in the file table)
//   ownedFiles     - files where they are the top author
//   highRiskFiles  - owned files at the High level: the files that would lose
//                    the person who knows them best if this author left
//   touchedFiles   - every file they have a share of
//   lastActiveAt   - their latest commit to any file (null for sample data)
// Sorted by high-risk files, then owned files, then name.
export function summarizePeople(files) {
  const byName = new Map();

  const entryFor = (name) => {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        ownedFiles: [],
        highRiskFiles: [],
        touchedFiles: [],
        lastActiveAt: null,
      });
    }
    return byName.get(name);
  };

  for (const file of files) {
    for (const author of file.authors) {
      const person = entryFor(author.name);
      person.touchedFiles.push(file);
      if (author.lastCommitAt && (!person.lastActiveAt || author.lastCommitAt > person.lastActiveAt)) {
        person.lastActiveAt = author.lastCommitAt;
      }
    }

    const owner = entryFor(file.topAuthor);
    owner.ownedFiles.push(file);
    if (getRiskLevel(file.riskScore).name === "high") owner.highRiskFiles.push(file);
  }

  return [...byName.values()].sort(
    (a, b) =>
      b.highRiskFiles.length - a.highRiskFiles.length ||
      b.ownedFiles.length - a.ownedFiles.length ||
      a.name.localeCompare(b.name)
  );
}

// Returns one author's share of each file they worked on, riskiest file first:
// [{ file, share, historicalShare, isOwner }]
export function filesForPerson(files, name) {
  return files
    .flatMap((file) => {
      const author = file.authors.find((a) => a.name === name);
      if (!author) return [];
      return [
        {
          file,
          share: author.share,
          historicalShare: author.historicalShare,
          isOwner: file.topAuthor === name,
        },
      ];
    })
    .sort((a, b) => b.file.riskScore - a.file.riskScore);
}

// The repo's bus factor: the fewest people who, between them, are the main
// owner of more than half the files. If they all left, most of the code would
// lose the person who knows it best. Returns { count, names }; count is 0 when
// there are no files.
export function busFactor(files, people) {
  const half = files.length / 2;
  const byOwnership = [...people].sort((a, b) => b.ownedFiles.length - a.ownedFiles.length);
  const names = [];
  let covered = 0;
  for (const person of byOwnership) {
    if (covered > half) break;
    covered += person.ownedFiles.length;
    names.push(person.name);
  }
  return { count: files.length === 0 ? 0 : names.length, names };
}
