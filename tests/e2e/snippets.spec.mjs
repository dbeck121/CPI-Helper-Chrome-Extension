// changes the tenant only in memory: copies a step of CPI_IFLOW_URL, saves it as snippet, pastes it into
// CPI_SNIPPETS_IFLOW_URL in edit mode and discards the edit. Runs only with E2E_ALLOW_EDIT=true
import fs from "node:fs";
import path from "node:path";
import { test, expect, openIflow, bigPopup } from "./fixtures.mjs";
import { env, requireEnv, repoRoot } from "./env.mjs";

test.skip(process.env.E2E_ALLOW_EDIT !== "true" || !env.snippetsIflowUrl, "set E2E_ALLOW_EDIT=true and CPI_SNIPPETS_IFLOW_URL in .env");

const NAME = "e2e snippet " + Date.now();

// the feature is off by default, it is switched on in the danger zone of the popup settings
async function setSnippetsSetting(page, on) {
  const id = fs.readFileSync(path.join(repoRoot, "test-results", ".extension-id"), "utf8").trim();
  const popup = await page.context().newPage();
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.locator('.tab-btn[data-tab="three"]').click();
  await popup.locator(`#cpiHelper_experimental_snippets button[data-value="${on}"]`).click();
  await expect(popup.locator(`#cpiHelper_experimental_snippets button[data-value="${on}"]`)).toHaveClass(/active/);
  await popup.close();
}

async function openSnippets(page) {
  await page.locator("#__buttonsnippets").click();
  await expect(page.locator(".cpiHelper_snippets")).toBeVisible();
}

test("copy a step, save it as snippet, paste it into another iFlow", async ({ page, extensionErrors }) => {
  test.setTimeout(5 * 60_000);
  await page.setViewportSize({ width: 1500, height: 950 });

  // off: no button in the toolbar
  await setSnippetsSetting(page, false);
  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
  await expect(page.locator("#__buttonsnippets")).toHaveCount(0);
  // switched on: the button appears without a reload
  await setSnippetsSetting(page, true);
  await expect(page.locator("#__buttonsnippets")).toBeVisible({ timeout: 10_000 });

  // copy the first activity of the source iFlow (view mode is enough for Copy)
  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
  // a step whose center is not covered by a CPI Helper toolbar or popup
  // the diagram renders after the toolbar, retry until a step is there and free
  const findFreeStep = () => page.evaluate(() => {
    for (const shape of document.querySelectorAll("[id^='BPMNShape_CallActivity_']")) {
      const r = shape.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      // the label of a step is drawn next to its shape group, so accept any diagram element that no CPI Helper element covers
      if (x > 0 && y > 0 && x < innerWidth && y < innerHeight && hit && hit.closest("svg") && !hit.closest("#cpihelperglobal, [id^='cpiHelper_']")) return { x, y };
    }
    return null;
  });
  await expect.poll(findFreeStep, { timeout: 30_000, message: "no free step to click in the source iFlow" }).not.toBeNull();
  const point = await findFreeStep();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("[title='Copy']").first()).toBeEnabled();
  await page.locator("[title='Copy']").first().click();

  // save it (and remove what an aborted run left behind)
  await openSnippets(page);
  const leftovers = page.locator(".cpiHelper_snippets_item", { has: page.locator(".cpiHelper_snippets_title", { hasText: /^e2e snippet / }) });
  for (let count = await leftovers.count(); count > 0; count--) {
    await leftovers.first().locator('[data-action="delete"]').click();
    await page.locator(".cpiHelper_confirm_modal .approve").click();
    // the list renders again after each delete
    await expect(leftovers).toHaveCount(count - 1);
  }
  await expect(page.locator(".cpiHelper_snippets_clipboard .sub.header")).toContainText("1 element");
  await page.locator(".cpiHelper_snippets_name").fill(NAME);
  await page.locator('[data-action="capture"]').click();
  await expect(page.locator(".cpiHelper_snippets_title", { hasText: NAME })).toBeVisible();

  // duplicate, export and import round trip
  const item = page.locator(".cpiHelper_snippets_item", { has: page.locator(".cpiHelper_snippets_title", { hasText: NAME }) });
  await item.locator('[data-action="duplicate"]').click();
  await expect(page.locator(".cpiHelper_snippets_title", { hasText: NAME + " (copy)" })).toBeVisible();
  await page.keyboard.press("Escape");

  // paste into the test iFlow in edit mode
  await openIflow(page, env.snippetsIflowUrl);
  const shapesBefore = await page.locator("[id^='BPMNShape_']").count();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  // a run that was aborted may have left a draft of this test iFlow: discard it
  const recover = page.locator("[role=dialog], [role=alertdialog]").filter({ hasText: /Recover/ }).getByRole("button", { name: "Discard", exact: true });
  if (await recover.waitFor({ timeout: 5_000 }).then(() => true, () => false)) await recover.click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true }).first()).toBeVisible({ timeout: 30_000 });
  try {
    await openSnippets(page);
    await item.first().locator('[data-action="use"]').click();
    await expect(page.locator(".cpiHelper_toast_container .ui.toast", { hasText: "is in the CPI clipboard" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("[id^='BPMNShape_Participant_Process']").first().click({ position: { x: 40, y: 12 } });
    await page.locator("[title='Paste']").first().click();
    await expect(page.locator("[id^='BPMNShape_']")).toHaveCount(shapesBefore + 1, { timeout: 30_000 });
  } finally {
    // never save: cancel and discard
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    const discard = page.locator("[role=dialog], [role=alertdialog]").getByRole("button", { name: "Discard", exact: true });
    if (await discard.waitFor({ timeout: 10_000 }).then(() => true, () => false)) await discard.click();
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({ timeout: 30_000 });
  }
  await expect(page.locator("[id^='BPMNShape_']")).toHaveCount(shapesBefore);

  // clean up the snippets of this test
  await openSnippets(page);
  for (const title of [NAME + " (copy)", NAME]) {
    await page.locator(".cpiHelper_snippets_item", { has: page.locator(".cpiHelper_snippets_title", { hasText: new RegExp("^" + title.replace(/[()]/g, "\\$&") + "$") }) }).locator('[data-action="delete"]').click();
    await page.locator(".cpiHelper_confirm_modal .approve").click();
  }
  await expect(page.locator(".cpiHelper_snippets_title", { hasText: NAME })).toHaveCount(0);
  await expect(bigPopup(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await setSnippetsSetting(page, false);
  await expect(page.locator("#__buttonsnippets")).toHaveCount(0, { timeout: 10_000 });
  expect(extensionErrors).toEqual([]);
});
