// read only checks on an API artifact (CPI_API_URL). these run on the integration cell by default
import { test, expect, openIflow, bigPopup } from "./fixtures.mjs";
import { env } from "./env.mjs";

test.describe("API artifact", () => {
  test.skip(!env.apiUrl, "CPI_API_URL is not set in .env");

  test.beforeEach(async ({ page }) => {
    // same entry as an iFlow: toolbar on the artifact page
    await openIflow(page, env.apiUrl);
  });

  test("toolbar, runtime and deploy state", async ({ page, extensionErrors }) => {
    for (const id of ["#__buttonxx", "#__buttonxy", "#__buttoninfo", "#__more_logs"]) await expect(page.locator(id)).toBeVisible();
    if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
    const sidebar = page.locator("#cpiHelper_content");
    await expect(sidebar).toContainText("Runtime:");
    // the deploy state comes from the runtime of the selected location, not always from the main runtime
    await expect(page.locator("#deploymentText")).not.toHaveText(/UNDEPLOYED/, { timeout: 30_000 });

    const runtime = page.locator("#__runtime_button");
    if (await runtime.count()) {
      await expect(runtime.locator(".cpiHelper_floatingToolbar_badge")).toHaveText(/\d/);
      await runtime.click();
      const items = page.locator(".cpiHelper_floatingToolbar_menu:not([hidden]) .cpiHelper_floatingToolbar_menuItem");
      await expect(items.first()).toBeVisible();
      await expect(items.filter({ hasText: "(deployed)" })).toHaveCount(1, { timeout: 30_000 });
      await page.keyboard.press("Escape");
    }
    expect(extensionErrors).toEqual([]);
  });

  test("info popup and log viewer", async ({ page, extensionErrors }) => {
    await page.locator("#__buttoninfo").click();
    await expect(bigPopup(page)).toBeVisible();
    await expect(page.locator("#cpiHelper_semanticui_modal .cpiHelper_infoPopUp_items").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(bigPopup(page)).toBeHidden();

    await page.locator("#__more_logs").click();
    await expect(bigPopup(page)).toBeVisible();
    const entry = page.locator(".cpiHelper_logs_entry").first();
    if (await entry.waitFor({ timeout: 30_000 }).then(() => true, () => false)) {
      await entry.click();
      await expect(page.locator("#cpiHelper_logsInfo")).toBeVisible({ timeout: 30_000 });
    }
    await page.keyboard.press("Escape");
    expect(extensionErrors).toEqual([]);
  });
});
