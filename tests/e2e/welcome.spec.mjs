// the one time welcome for an update from 3.x to 4.x (scripts/celebration.js) and the toolbar tour. Simulated by
// setting the stored version back to 3.x; the storage values are restored afterwards
import fs from "node:fs";
import path from "node:path";
import { test, expect, openIflow, expectLoggedIn } from "./fixtures.mjs";
import { env, requireEnv, repoRoot } from "./env.mjs";

const KEYS = ["cpiHelper_Version", "cpiHelper_v4Celebrated"];

// chrome.storage.local of the extension, through its popup page
async function extensionStorage(page, fn, arg) {
  const id = fs.readFileSync(path.join(repoRoot, "test-results", ".extension-id"), "utf8").trim();
  const popup = await page.context().newPage();
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  const result = await popup.evaluate(fn, arg);
  await popup.close();
  return result;
}

const readKeys = (page) => extensionStorage(page, (keys) => chrome.storage.local.get(keys), KEYS);
const simulateUpgrade = (page) => extensionStorage(page, async () => {
  await chrome.storage.local.set({ cpiHelper_Version: "3.14.4" });
  await chrome.storage.local.remove("cpiHelper_v4Celebrated");
});
const restore = (page, saved) => extensionStorage(page, async ({ saved, keys }) => {
  await chrome.storage.local.remove(keys);
  await chrome.storage.local.set(saved);
}, { saved, keys: KEYS });

// clicks through the tour and returns the step titles
async function walkTour(page) {
  const card = page.locator(".cpiHelper_tour_card");
  await expect(card).toBeVisible({ timeout: 20_000 });
  const titles = [];
  for (let i = 0; i < 10 && (await card.isVisible()); i++) {
    titles.push(await card.locator(".cpiHelper_tour_title").innerText());
    await card.locator(".cpiHelper_tour_next").click();
  }
  await expect(page.locator("#cpiHelper_tour")).toHaveCount(0);
  return titles;
}

test.describe("welcome to 4.0", () => {
  test("update from 3.x shows the welcome once, the tour covers search and navigation", async ({ page, extensionErrors }) => {
    test.setTimeout(150_000);
    const saved = await readKeys(page);
    try {
      await simulateUpgrade(page);
      await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
      const welcome = page.locator("#cpiHelper_celebration");
      await expect(welcome).toBeVisible({ timeout: 30_000 });
      await expect(welcome).toContainText("search for every iFlow");
      await welcome.locator(".cpiHelper_celebration_primary").click();
      expect(await walkTour(page)).toEqual(["Your buttons live here now", "Search and jump from anywhere", "Drag me by the header", "Plugins and the compact view"]);

      // only once
      await page.reload();
      await expect(page.locator("#cpiHelper_floatingToolbar")).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(4000);
      await expect(welcome).toHaveCount(0);
    } finally {
      await restore(page, saved);
    }
    expect(extensionErrors).toEqual([]);
  });

  test("the welcome also comes outside of an iFlow, its tour skips the artifact buttons", async ({ page, extensionErrors }) => {
    test.setTimeout(150_000);
    const saved = await readKeys(page);
    try {
      await simulateUpgrade(page);
      const url = new URL(requireEnv("CPI_URL", env.cpiUrl)).origin + "/shell/monitoring/Overview";
      await page.goto(url);
      await expectLoggedIn(page, url);
      const welcome = page.locator("#cpiHelper_celebration");
      await expect(welcome).toBeVisible({ timeout: 60_000 });
      await welcome.locator(".cpiHelper_celebration_primary").click();
      expect(await walkTour(page)).toEqual(["Search and jump from anywhere", "Drag me by the header", "Plugins and the compact view"]);
    } finally {
      await restore(page, saved);
    }
    expect(extensionErrors).toEqual([]);
  });
});
