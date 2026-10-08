// Sample: a high-risk repo where one person (dana) wrote almost everything.
// This is the scenario Cortex exists to catch. Fictional repo and people.
// Edge case: src/ledger/ledger.ts has a single author (100%).
import { makeFile } from "./makeFile.js";

export const paymentsServiceReport = {
  repo: {
    name: "acme-corp/payments-service",
    url: "https://github.com/acme-corp/payments-service",
    branch: "main",
    analyzedAt: "2026-10-06T09:12:00Z",
    commitCount: 860,
    contributorCount: 3,
    isSample: true,
  },
  files: [
    makeFile("src/billing/charge.ts", { dana: 0.97, li: 0.03 }),
    makeFile("src/billing/refund.ts", { dana: 0.91, omar: 0.09 }),
    makeFile("src/billing/currency.ts", { dana: 0.86, li: 0.14 }),
    makeFile("src/ledger/ledger.ts", { dana: 1 }),
    makeFile("src/ledger/reconcile.ts", { dana: 0.93, omar: 0.07 }),
    makeFile("src/gateways/stripe.ts", { li: 0.74, dana: 0.26 }),
    makeFile("src/gateways/paypal.ts", { omar: 0.72, dana: 0.28 }),
    makeFile("src/api/routes.ts", { dana: 0.58, li: 0.27, omar: 0.15 }),
    makeFile("src/api/middleware/auth.ts", { li: 0.55, dana: 0.45 }),
    makeFile("config/settings.ts", { dana: 0.38, li: 0.33, omar: 0.29 }),
    makeFile("tests/billing.test.ts", { omar: 0.62, li: 0.38 }),
    makeFile("README.md", { li: 0.4, dana: 0.35, omar: 0.25 }),
  ],
};
