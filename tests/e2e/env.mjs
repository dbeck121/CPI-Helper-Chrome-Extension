// reads .env from the repo root (git ignored), see .env.example
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = path.join(repoRoot, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const env = {
  cpiUrl: process.env.CPI_URL || "",
  iflowUrl: process.env.CPI_IFLOW_URL || "",
  apiUrl: process.env.CPI_API_URL || "",
  monitorUrl: process.env.CPI_MONITOR_URL || "",
  profileDir: path.resolve(repoRoot, process.env.E2E_PROFILE_DIR || ".e2e-profile"),
  cdpPort: Number(process.env.E2E_CDP_PORT || 9333),
};

export function requireEnv(name, value) {
  if (!value || value.includes("<")) throw new Error(`${name} is missing in .env (see .env.example)`);
  return value;
}
