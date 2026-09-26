import { defineConfig } from "@playwright/test";
import path from "node:path";
import { repoRoot } from "./env.mjs";

// the tests share the one logged in browser from `npm run e2e:browser`, so they run one after another
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  outputDir: path.join(repoRoot, "test-results"),
  reporter: [["list"], ["html", { outputFolder: path.join(repoRoot, "playwright-report"), open: "never" }]],
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
