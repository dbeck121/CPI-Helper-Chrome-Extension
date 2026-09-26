// changes the tenant only in memory: copies a step of CPI_IFLOW_URL, saves it as snippet, pastes it into
// CPI_SNIPPETS_IFLOW_URL in edit mode and discards the edit. Runs only with E2E_ALLOW_EDIT=true
import { test, expect, openIflow, bigPopup } from "./fixtures.mjs";
import { env, requireEnv } from "./env.mjs";

test.skip(process.env.E2E_ALLOW_EDIT !== "true" || !env.snippetsIflowUrl, "set E2E_ALLOW_EDIT=true and CPI_SNIPPETS_IFLOW_URL in .env");

const NAME = "e2e snippet " + Date.now();

async function openSnippets(page) {
  await page.locator("#__buttonsnippets").click();
  await expect(page.locator(".cpiHelper_snippets")).toBeVisible();
}

test("copy a step, save it as snippet, paste it into another iFlow", async ({ page, extensionErrors }) => {
  test.setTimeout(5 * 60_000);
  await page.setViewportSize({ width: 1500, height: 950 });

  // copy the first activity of the source iFlow (view mode is enough for Copy)
  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
  const activity = page.locator("[id^='BPMNShape_CallActivity_']").first();
  const box = await activity.boundingBox();
  await page.evaluate(() => (document.getElementById("cpiHelper_floatingToolbar").style.visibility = "hidden"));
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => (document.getElementById("cpiHelper_floatingToolbar").style.visibility = "visible"));
  await page.locator("[title='Copy']").first().click();

  // save it
  await openSnippets(page);
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
  expect(extensionErrors).toEqual([]);
});
