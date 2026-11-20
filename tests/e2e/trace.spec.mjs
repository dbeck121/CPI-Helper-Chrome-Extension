// changes the tenant: switches trace on for CPI_IFLOW_URL, deploys it and debugs the new message with the inline trace.
// meant for a test iFlow that starts with a timer on deploy. skipped unless E2E_ALLOW_DEPLOY=true
import { test, expect, openIflow, bigPopup } from "./fixtures.mjs";
import { env, requireEnv } from "./env.mjs";

test.skip(process.env.E2E_ALLOW_DEPLOY !== "true", "set E2E_ALLOW_DEPLOY=true in .env to allow trace and deploy");

test("trace, deploy and inline trace with the payload viewer", async ({ page, extensionErrors }) => {
  test.setTimeout(8 * 60_000);
  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));

  // trace on (the button stays active while CPI Helper keeps refreshing the trace)
  const traceButton = page.locator("#__buttonxx");
  if (!(await traceButton.evaluate((element) => element.classList.contains("cpiHelper_floatingToolbar_button_active")))) {
    await traceButton.click();
  }
  await expect(traceButton).toHaveClass(/cpiHelper_floatingToolbar_button_active/);

  // newest message before the deploy
  if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
  const newestGuid = async () => (await page.locator("#cpiHelper_content button[id^='logs--']").first().getAttribute("class").catch(() => null))?.split(" ")[0] || null;
  await page.locator("#cpiHelper_content #messageList").waitFor({ timeout: 30_000 });
  const guidBefore = await newestGuid();

  // deploy, the timer of the test iFlow sends a message right after
  await page.getByRole("button", { name: "Deploy", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Do you want to deploy" });
  await dialog.getByRole("button", { name: "Yes" }).click();

  // the sidebar refreshes on its own, wait for a new message with an inline trace button
  await expect
    .poll(async () => ((await newestGuid()) !== guidBefore ? await page.locator("#cpiHelper_content button#inlinetrace--0").count() : 0), { timeout: 5 * 60_000, intervals: [5000] })
    .toBeGreaterThan(0);

  // inline trace marks the steps of the run in the diagram
  await page.locator("#cpiHelper_content button#inlinetrace--0").click();
  await expect(page.locator(".cpiHelper_onclick").first()).toBeAttached({ timeout: 60_000 });
  expect(await page.locator(".cpiHelper_onclick").count()).toBeGreaterThan(0);

  // a click on a step opens its trace. the start event has no body, so go through the steps until one has
  const steps = page.locator(".cpiHelper_onclick");
  const viewer = page.locator("#cpiHelper_semanticui_modal .cpiHelper_tabs_panel .cpiHelper_payload").filter({ visible: true }).first();
  let found = false;
  for (let index = 0; index < Math.min(await steps.count(), 8) && !found; index++) {
    await steps.nth(index).dispatchEvent("click");
    await expect(bigPopup(page)).toBeVisible({ timeout: 60_000 });
    await page.locator("#cpiHelper_semanticui_modal label.cpiHelper_tabs_label", { hasText: /^Body$/ }).click();
    found = await viewer.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false);
    if (!found) {
      await page.keyboard.press("Escape");
      await expect(bigPopup(page)).toBeHidden();
    }
  }
  expect(found, "no traced step with a body").toBe(true);
  await expect(viewer.locator(".ace_editor")).toBeVisible();
  await expect(viewer.locator(".ace_content")).not.toBeEmpty();
  await viewer.locator('[data-action="raw"]').click();
  await expect(viewer.locator('[data-action="raw"]')).toHaveAttribute("aria-pressed", "true");
  await viewer.locator('[data-action="fullscreen"]').click();
  await expect(viewer).toHaveClass(/cpiHelper_payload_fullscreen/);
  await page.keyboard.press("Escape");
  await expect(viewer).not.toHaveClass(/cpiHelper_payload_fullscreen/);
  await expect(bigPopup(page)).toBeVisible();
  // what the step changed: side by side diff with the content before the next step
  await page.locator("#cpiHelper_semanticui_modal label.cpiHelper_tabs_label", { hasText: /^Changes/ }).filter({ visible: true }).first().click();
  const changes = page.locator("#cpiHelper_semanticui_modal .cpiHelper_changes").filter({ visible: true }).first();
  await expect(changes).toBeVisible({ timeout: 60_000 });
  const lastStep = await changes.locator(".ui.info.message").isVisible().catch(() => false);
  if (!lastStep) {
    await expect(changes.locator(".cpiHelper_changes_side .ace_content")).toHaveCount(2, { timeout: 30_000 });
    await expect(changes.locator(".cpiHelper_changes_info")).not.toBeEmpty();
    await changes.locator('[data-view="headers"]').click();
    await expect(changes.locator('[data-view="headers"]')).toHaveAttribute("aria-pressed", "true");
  }
  await page.screenshot({ path: "test-results/changes-tab.png" });

  await page.keyboard.press("Escape");
  await expect(bigPopup(page)).toBeHidden();

  expect(extensionErrors).toEqual([]);
});
