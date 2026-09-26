// Starts Chromium with the unpacked extension from this repo and a DevTools port.
// Log in once in the window that opens and leave it open, `npm run e2e` connects to it.
// The profile folder keeps the login between runs as far as the SSO cookies allow.
// Branded Google Chrome no longer accepts --load-extension, so this uses the Chromium of Playwright
// (`npx playwright install chromium` once).
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { env, repoRoot, requireEnv } from "./env.mjs";

const startUrl = requireEnv("CPI_URL", env.cpiUrl);

try {
  const response = await fetch(`http://127.0.0.1:${env.cdpPort}/json/version`);
  if (response.ok) {
    console.log(`A browser already listens on port ${env.cdpPort}. Use it or close it first.`);
    process.exit(0);
  }
} catch {
  // nothing running, start one
}

const args = [
  `--user-data-dir=${env.profileDir}`,
  `--remote-debugging-port=${env.cdpPort}`,
  `--disable-extensions-except=${repoRoot}`,
  `--load-extension=${repoRoot}`,
  "--no-first-run",
  "--no-default-browser-check",
  startUrl,
];

const browser = spawn(chromium.executablePath(), args, { stdio: "ignore" });
console.log(`Chromium with CPI Helper started (DevTools port ${env.cdpPort}, profile ${env.profileDir}).`);
console.log("Log in, keep the window open and run: npm run e2e");
browser.on("exit", (code) => {
  console.log(`Chromium closed (${code ?? 0}).`);
  process.exit(0);
});
process.on("SIGINT", () => browser.kill());
process.on("SIGTERM", () => browser.kill());
