// the floating toolbar outside of artifacts: navigation, recent/favorites, command palette. Only reads the tenant;
// the only write is the favorite flag in the extension storage, which the test resets
import { test, expect, openIflow, expectLoggedIn, bigPopup } from "./fixtures.mjs";
import { env, requireEnv } from "./env.mjs";

const origin = () => new URL(requireEnv("CPI_URL", env.cpiUrl)).origin;
const iflowId = () => new URL(requireEnv("CPI_IFLOW_URL", env.iflowUrl)).pathname.match(/integrationflows\/([^/?]+)/)[1];
const toolbar = (page) => page.locator("#cpiHelper_floatingToolbar");
const toolbarButtonIds = (page) => page.locator("#cpiHelper_floatingToolbar > button:not(.cpiHelper_floatingToolbar_toggle)").evaluateAll((buttons) => buttons.map((b) => b.id));

async function openMonitoring(page) {
  const url = origin() + "/shell/monitoring/Overview";
  await page.goto(url);
  await expectLoggedIn(page, url);
  await expect(toolbar(page)).toBeVisible({ timeout: 60_000 });
}

test.describe("global toolbar", () => {
  test("outside of artifacts only the navigation and the plugins are on the toolbar", async ({ page, extensionErrors }) => {
    await openMonitoring(page);
    await expect.poll(() => toolbarButtonIds(page)).toEqual(["__cpih_search", "__cpih_jump", "__cpih_recent", "__more_plugins"]);
    await expect(toolbar(page)).toHaveAttribute("data-artifact-id", "global");
    expect(extensionErrors).toEqual([]);
  });

  test("Jump to navigates inside the app without a reload", async ({ page, extensionErrors }) => {
    await openMonitoring(page);
    await page.evaluate(() => (window.__cpihNoReload = true));
    await page.locator("#__cpih_jump").click();
    const entry = page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Message Queues" });
    await expect(entry).toHaveAttribute("href", /\/shell\/monitoring\/MessageQueues$/);
    await entry.click();
    await expect(page).toHaveURL(/\/shell\/monitoring\/MessageQueues/);
    await expect(page.getByText("Manage Message Queues").first()).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => window.__cpihNoReload)).toBe(true);
    await expect(toolbar(page)).toBeVisible();
    expect(extensionErrors).toEqual([]);
  });

  test("failed messages badge matches the monitor count", async ({ page, extensionErrors }) => {
    await openMonitoring(page);
    const count = await page.evaluate(async () => {
      const since = new Date(Date.now() - 3600e3).toISOString().slice(0, 19);
      const response = await fetch(`/odata/api/v1/MessageProcessingLogs/$count?$filter=${encodeURIComponent(`Status eq 'FAILED' and LogEnd gt datetime'${since}'`)}`);
      return parseInt(await response.text(), 10);
    });
    const badge = page.locator("#__cpih_jump .cpiHelper_floatingToolbar_badge_alert");
    if (count > 0) {
      await expect(badge).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("#__cpih_jump")).toHaveAttribute("data-cpi-hint", /failed message/);
      await page.locator("#__cpih_jump").click();
      await expect(page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Failed Messages" }).locator(".cpiHelper_floatingToolbar_menuDetail")).toBeVisible();
    } else {
      await page.waitForTimeout(3000);
      await expect(badge).toHaveCount(0);
    }
    expect(extensionErrors).toEqual([]);
  });

  test("Plugins opens the plugin management", async ({ page, extensionErrors }) => {
    await openMonitoring(page);
    await page.locator("#__more_plugins").click();
    await expect(bigPopup(page)).toBeVisible();
    expect(await page.locator("#cpiHelper_popup_plugins .ui.card, .cpiHelper_pluginCard, #cpiHelper_semanticui_modal .card").count()).toBeGreaterThan(3);
    expect(extensionErrors).toEqual([]);
  });

  test("iFlow toolbar has the artifact jumps, messages of the iFlow open filtered", async ({ page, extensionErrors }) => {
    await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
    await expect(page.locator("#__buttonxx")).toBeVisible();
    await expect(page.locator("#__cpih_recent")).toBeVisible();
    await page.locator("#__cpih_jump").click();
    await expect(page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Open package" })).toBeVisible();
    await expect(page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Deployment status" })).toBeVisible();
    await page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Messages of this artifact" }).click();
    await expect(page).toHaveURL(/\/shell\/monitoring\/Messages\//);
    // the page has to show the monitor, not only the url
    await expect(page.getByText("Monitor Message Processing").first()).toBeVisible({ timeout: 60_000 });
    expect(decodeURIComponent(page.url())).toContain(`"artifactIds":["${iflowId()}"]`);
    // back on a page without artifact the toolbar switches to the global variant
    await expect(toolbar(page)).toHaveAttribute("data-artifact-id", "global", { timeout: 15_000 });
    expect(extensionErrors).toEqual([]);
  });

  test("from an iFlow reached inside the app, Jump to All Messages shows the monitor", async ({ page, extensionErrors }) => {
    test.setTimeout(150_000);
    // monitor app loaded first, then the iFlow through the palette (no reload), then back to the monitor
    await openMonitoring(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator(".cpiHelper_palette_status")).toContainText(/artifacts in \d+ packages/, { timeout: 90_000 });
    await page.locator(".cpiHelper_palette_input").fill(iflowId().replace(/_/g, " "));
    await page.keyboard.press("Enter");
    await expect(page.locator("#__buttonxx")).toBeVisible({ timeout: 60_000 });
    await page.locator("#__cpih_jump").click();
    await page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "All Messages" }).click();
    await expect(page).toHaveURL(/\/shell\/monitoring\/Messages\//);
    await expect(page.getByText("Monitor Message Processing").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("#__buttonxx")).toHaveCount(0);
    expect(extensionErrors).toEqual([]);
  });

  test("visited iFlow shows in Recent, a favorite survives a reload", async ({ page, extensionErrors }) => {
    await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
    await openMonitoring(page);
    const row = () => page.locator(`.cpiHelper_recent_item[href*="/integrationflows/${iflowId()}"]`);
    await page.locator("#__cpih_recent").click();
    await expect(row()).toBeVisible({ timeout: 40_000 });

    const star = row().locator(".cpiHelper_recent_star");
    const wasFavorite = (await star.getAttribute("aria-pressed")) === "true";
    if (!wasFavorite) await star.click();
    await expect(row().locator(".cpiHelper_recent_star")).toHaveAttribute("aria-pressed", "true");
    const favoritesList = page.locator(".cpiHelper_recent_heading", { hasText: "Favorites" }).locator("+ .cpiHelper_recent_list");
    await expect(favoritesList.locator(`[href*="/integrationflows/${iflowId()}"]`)).toBeVisible();

    await page.reload();
    await expect(toolbar(page)).toBeVisible({ timeout: 60_000 });
    await page.locator("#__cpih_recent").click();
    await expect(favoritesList.locator(`[href*="/integrationflows/${iflowId()}"]`)).toBeVisible();

    // leave the storage as it was
    if (!wasFavorite) {
      await row().locator(".cpiHelper_recent_star").click();
      await expect(row().locator(".cpiHelper_recent_star")).toHaveAttribute("aria-pressed", "false");
    }
    expect(extensionErrors).toEqual([]);
  });

  test("command palette finds the iFlow and opens it", async ({ page, extensionErrors }) => {
    test.setTimeout(150_000);
    await openMonitoring(page);
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.locator(".cpiHelper_palette_input");
    await expect(input).toBeFocused();
    await expect(page.locator(".cpiHelper_palette_status")).toContainText(/artifacts in \d+ packages/, { timeout: 90_000 });
    await input.fill(iflowId().replace(/_/g, " "));
    const first = page.locator(".cpiHelper_palette_item").first();
    await expect(first.locator("a")).toHaveAttribute("href", new RegExp(`/integrationflows/${iflowId()}$`));
    await input.press("Enter");
    await expect(page.locator("#cpiHelper_palette")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/integrationflows/${iflowId()}`));
    await expect(page.locator("#__buttonxx")).toBeVisible({ timeout: 60_000 });

    // Escape closes, the toolbar button opens it too
    await page.locator("#__cpih_search").click();
    await expect(page.locator(".cpiHelper_palette_input")).toBeFocused();
    await expect(page.locator(".cpiHelper_palette_item", { hasText: "Messages of this artifact" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#cpiHelper_palette")).toHaveCount(0);
    expect(extensionErrors).toEqual([]);
  });

  test("command palette runs the actions of the iFlow page", async ({ page, extensionErrors }) => {
    await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));
    await expect(page.locator("#__buttonxx")).toBeVisible();
    const palette = async (query) => {
      await page.keyboard.press("ControlOrMeta+k");
      await expect(page.locator(".cpiHelper_palette_input")).toBeFocused();
      await page.locator(".cpiHelper_palette_input").fill(query);
    };
    const item = (label) => page.locator(".cpiHelper_palette_item", { hasText: label });

    // without a query the actions and the jump targets are listed
    await palette("");
    for (const label of ["Deploy", "Info", "Logs", "Messages of this artifact", "Deployment status", "Open package", "Message Queues"]) {
      await expect(item(label).first()).toBeVisible();
    }
    await expect(item(/Start trace|Stop trace/).first()).toBeVisible();
    await expect(item("Monitor - Message Queues")).toBeVisible();
    await page.keyboard.press("Escape");

    // other words for the actions
    await palette("trace on");
    await expect(page.locator(".cpiHelper_palette_item").first()).toContainText(/Start trace|Stop trace/);
    await page.keyboard.press("Escape");

    // message sidebar opens and closes
    const sidebarOpen = await page.locator("#cpiHelper_content").isVisible();
    await palette(sidebarOpen ? "close message" : "open message");
    await page.keyboard.press("Enter");
    await expect(page.locator("#cpiHelper_content")).toBeVisible({ visible: !sidebarOpen });
    await palette(sidebarOpen ? "open message" : "close message");
    await page.keyboard.press("Enter");
    await expect(page.locator("#cpiHelper_content")).toBeVisible({ visible: sidebarOpen });

    // deploy goes through the confirmation of the CPI, which is cancelled here
    await palette("deploy");
    await expect(item("Deploy").first()).toBeVisible();
    await item("Deploy").filter({ hasNotText: "trace" }).first().click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Do you want to deploy" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "No" }).click();
    await expect(dialog).toBeHidden();

    // trace and deploy switches trace on first (allowed on the test iFlow, see trace.spec.mjs), the deploy is cancelled again
    if (process.env.E2E_ALLOW_DEPLOY === "true") {
      const traceButton = page.locator("#__buttonxx");
      if (await traceButton.evaluate((element) => element.classList.contains("cpiHelper_floatingToolbar_button_active"))) {
        await palette("stop trace");
        await page.keyboard.press("Enter");
        await expect(traceButton).not.toHaveClass(/cpiHelper_floatingToolbar_button_active/);
      }
      await palette("trace and deploy");
      await page.keyboard.press("Enter");
      await expect(traceButton).toHaveClass(/cpiHelper_floatingToolbar_button_active/);
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await dialog.getByRole("button", { name: "No" }).click();
      await expect(dialog).toBeHidden();
    }
    expect(extensionErrors).toEqual([]);
  });

  test("in edit mode Jump to does not leave the editor", async ({ page, extensionErrors }) => {
    test.skip(!env.snippetsIflowUrl, "CPI_SNIPPETS_IFLOW_URL is the iFlow that may be put in edit mode (never saved)");
    await openIflow(page, env.snippetsIflowUrl);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "Cancel", exact: true }).first()).toBeVisible({ timeout: 30_000 });
    try {
      await page.locator("#__cpih_jump").click();
      await page.locator(".cpiHelper_floatingToolbar_menuItem", { hasText: "Message Queues" }).click();
      await expect(page.getByText("You are editing").first()).toBeVisible();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/\/integrationflows\//);
      await expect(page.getByRole("button", { name: "Cancel", exact: true }).first()).toBeVisible();
    } finally {
      // never save: cancel and discard
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
      const discard = page.locator("[role=dialog], [role=alertdialog]").getByRole("button", { name: "Discard", exact: true });
      if (await discard.waitFor({ timeout: 10_000 }).then(() => true, () => false)) await discard.click();
      await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible({ timeout: 30_000 });
    }
    expect(extensionErrors).toEqual([]);
  });
});
