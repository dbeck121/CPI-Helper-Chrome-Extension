// read only: a step whose trace fails to load must not block further clicks on the inline trace.
// the trace requests are answered with an error. needs a message of CPI_IFLOW_URL with log level TRACE from the
// last hour (e.g. after trace.spec.mjs), skipped otherwise
import { test, expect, openIflow, bigPopup } from "./fixtures.mjs";
import { env, requireEnv } from "./env.mjs";

test("a failing trace request does not block the next click on a step", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.route(/odata\/api\/v1\/MessageProcessingLogRunSteps\(.*\/TraceMessages/, (route) => route.fulfill({ status: 500, body: "failed on purpose" }));

  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));

  if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
  await page.locator("#cpiHelper_content #messageList").waitFor({ timeout: 30_000 });
  const inlineTraceButton = page.locator("#cpiHelper_content button#inlinetrace--0");
  test.skip(!(await inlineTraceButton.isVisible().catch(() => false)), "no message with trace in the message sidebar");
  await inlineTraceButton.click();
  const steps = page.locator(".cpiHelper_onclick:not([id*='StartEvent'])");
  await expect(steps.first()).toBeAttached({ timeout: 60_000 });

  // before the fix the first failing tab left the click pending for good and every further click was ignored
  for (let round = 0; round < 2; round++) {
    await steps.nth(round % (await steps.count())).dispatchEvent("click");
    await expect(bigPopup(page), `popup of click ${round + 1}`).toBeVisible({ timeout: 30_000 });
    await expect(bigPopup(page)).toContainText("The content could not be loaded.");
    await page.keyboard.press("Escape");
    await expect(bigPopup(page)).toBeHidden();
  }
});

test("steps stay clickable after the inline trace was switched off and on again", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await openIflow(page, requireEnv("CPI_IFLOW_URL", env.iflowUrl));

  if (!(await page.locator("#cpiHelper_content").isVisible())) await page.locator("#__buttonxy").click();
  await page.locator("#cpiHelper_content #messageList").waitFor({ timeout: 30_000 });
  const inlineTraceButton = page.locator("#cpiHelper_content button#inlinetrace--0");
  test.skip(!(await inlineTraceButton.isVisible().catch(() => false)), "no message with trace in the message sidebar");
  const steps = page.locator(".cpiHelper_onclick:not([id*='StartEvent'])");

  // on, off, on: the steps that were clickable before have to get their click handler back
  await inlineTraceButton.click();
  await expect(steps.first()).toBeAttached({ timeout: 60_000 });
  await inlineTraceButton.click();
  await expect(page.locator(".cpiHelper_inlineInfo")).toHaveCount(0);
  await inlineTraceButton.click();
  await expect(page.locator(".cpiHelper_inlineInfo").first()).toBeAttached({ timeout: 60_000 });

  await steps.first().dispatchEvent("click");
  await expect(bigPopup(page)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(bigPopup(page)).toBeHidden();
});
