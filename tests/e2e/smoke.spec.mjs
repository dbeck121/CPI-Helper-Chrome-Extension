// read only checks against a real tenant. nothing here switches trace, deploys, unlocks or writes to the tenant (see trace.spec.mjs for that)
import { test, expect, openIflow, expectLoggedIn, bigPopup } from "./fixtures.mjs";
import { env, requireEnv } from "./env.mjs";

test.describe("start page", () => {
  test("CPI Helper button in the shell header opens the global popup with plugins", async ({ page, extensionErrors }) => {
    const url = requireEnv("CPI_URL", env.cpiUrl);
    await page.goto(url);
    await expectLoggedIn(page, url);
    const cloud = page.locator("#__cpihelper");
    await expect(cloud).toBeVisible({ timeout: 60_000 });
    await cloud.click();
    await expect(bigPopup(page)).toBeVisible();
    await page.locator('#cpiHelper_semanticui_modal .item[data-tab="plugins"]').click();
    await expect(page.locator("#cpiHelper_popup_plugins .ui.card").first()).toBeVisible();
    expect(await page.locator("#cpiHelper_popup_plugins .ui.card").count()).toBeGreaterThan(5);
    await page.keyboard.press("Escape");
    await expect(bigPopup(page)).toBeHidden();
    expect(extensionErrors).toEqual([]);
  });
});

test.describe("iFlow", () => {
  test.beforeEach(async ({ page }) => {
    await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
  });

  test("toolbar and message sidebar", async ({ page, extensionErrors }) => {
    await expect(page.locator("#__buttonxy")).toBeVisible();
    if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
    await expect(page.locator("#cpiHelper_content")).toBeVisible();
    await expect(page.locator("#cpiHelper_contentheader")).toBeVisible();
    expect(extensionErrors).toEqual([]);
  });

  test("message sidebar opens next to the toolbar, not below it", async ({ page, extensionErrors }) => {
    await page.setViewportSize({ width: 1500, height: 950 });
    await page.reload();
    await expect(page.locator("#cpiHelper_floatingToolbar")).toBeVisible({ timeout: 60_000 });
    if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
    await expect(page.locator("#cpiHelper_content")).toBeVisible();
    await page.waitForTimeout(500);
    const bar = await page.locator("#cpiHelper_floatingToolbar").boundingBox();
    const sidebar = await page.locator("#cpiHelper_content").boundingBox();
    const overlap = !(sidebar.x + sidebar.width <= bar.x || bar.x + bar.width <= sidebar.x || sidebar.y + sidebar.height <= bar.y || bar.y + bar.height <= sidebar.y);
    expect(overlap, "sidebar and toolbar overlap").toBe(false);
    expect(extensionErrors).toEqual([]);
  });

  test("info popup opens and closes with the close button", async ({ page, extensionErrors }) => {
    await page.locator("#__buttoninfo").click();
    await expect(bigPopup(page)).toBeVisible();
    await expect(page.locator("#cpiHelper_semanticui_modal > .header")).toContainText("General Information");
    await expect(page.locator("#cpiHelper_semanticui_modal .cpiHelper_infoPopUp_items").first()).toBeVisible();
    await page.locator("#cpiHelper_semanticui_modal .actions .deny").click();
    await expect(bigPopup(page)).toBeHidden();
    expect(extensionErrors).toEqual([]);
  });

  test("what's new dialog switches tabs", async ({ page, extensionErrors }) => {
    await page.locator("#__buttoninfo").click();
    await page.getByRole("button", { name: "Whats New?" }).click();
    const tabs = page.locator("#cpiHelper_whatsnew_tabs");
    await expect(tabs).toBeVisible();
    await tabs.locator('.item[data-tab="changes"]').click();
    await expect(page.locator('.ui.tab[data-tab="changes"]')).toHaveClass(/active/);
    await expect(page.locator('.ui.tab[data-tab="one"]')).not.toHaveClass(/active/);
    await page.keyboard.press("Escape");
    expect(extensionErrors).toEqual([]);
  });

  test("log viewer of the newest message shows the payload viewer", async ({ page, extensionErrors }) => {
    if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
    const logsButton = page.locator("#cpiHelper_content button[id^='logs--']").first();
    // isVisible() does not wait, waitFor does
    const hasMessages = await logsButton.waitFor({ state: "visible", timeout: 30_000 }).then(() => true, () => false);
    test.skip(!hasMessages, "no processed messages for this iFlow");
    await logsButton.click();
    await expect(bigPopup(page)).toBeVisible({ timeout: 60_000 });
    // properties are always there, attachments and bodies use the payload viewer
    const viewer = page.locator("#cpiHelper_semanticui_modal .cpiHelper_payload").first();
    if (await viewer.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)) {
      await expect(viewer.locator(".ace_editor")).toBeVisible();
      await viewer.locator('[data-action="fullscreen"]').click();
      await expect(viewer).toHaveClass(/cpiHelper_payload_fullscreen/);
      await page.keyboard.press("Escape");
      await expect(viewer).not.toHaveClass(/cpiHelper_payload_fullscreen/);
      await expect(bigPopup(page)).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(bigPopup(page)).toBeHidden();
    expect(extensionErrors).toEqual([]);
  });
});
