// Sample: a healthy repo where six people share ownership, so most files are
// low risk. One hotspot (the scheduler) shows that risk can hide in a healthy
// team. Fictional repo and people.
// Edge case: tests/test_transform.py has a four-way tie at 25%.
import { makeFile } from "./makeFile.js";

export const dataPipelineReport = {
  repo: {
    name: "openlab/data-pipeline",
    url: "https://github.com/openlab/data-pipeline",
    branch: "develop",
    analyzedAt: "2026-10-05T18:45:00Z",
    commitCount: 1530,
    contributorCount: 6,
    isSample: true,
  },
  files: [
    makeFile("pipeline/extract/s3_reader.py", { ana: 0.31, ben: 0.27, chen: 0.22, dev: 0.2 }),
    makeFile("pipeline/extract/api_client.py", { ben: 0.36, eli: 0.34, fay: 0.3 }),
    makeFile("pipeline/transform/clean.py", { chen: 0.28, ana: 0.26, dev: 0.24, fay: 0.22 }),
    makeFile("pipeline/transform/dedupe.py", { dev: 0.45, chen: 0.3, ana: 0.25 }),
    makeFile("pipeline/transform/enrich.py", { ben: 0.35, eli: 0.33, fay: 0.32 }),
    makeFile("pipeline/load/warehouse.py", { fay: 0.52, ana: 0.28, eli: 0.2 }),
    makeFile("pipeline/load/schema.py", { ana: 0.29, ben: 0.26, chen: 0.24, dev: 0.21 }),
    makeFile("pipeline/scheduler/dag.py", { chen: 0.74, dev: 0.26 }),
    makeFile("pipeline/utils/retry.py", { dev: 0.3, eli: 0.27, fay: 0.23, ana: 0.2 }),
    makeFile("tests/test_transform.py", { fay: 0.25, ana: 0.25, ben: 0.25, chen: 0.25 }),
    makeFile("docs/architecture.md", { eli: 0.41, ben: 0.33, chen: 0.26 }),
    makeFile("setup.py", { ana: 0.22, ben: 0.18, chen: 0.17, dev: 0.16, eli: 0.14, fay: 0.13 }),
  ],
};
