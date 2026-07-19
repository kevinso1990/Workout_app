/**
 * Quick smoke: onboarding → split selection → click Full Body (local or production).
 * Usage: node scripts/test-fullbody-click.mjs [baseUrl]
 */
import { chromium, devices } from "@playwright/test";

const baseURL = process.argv[2] ?? "http://127.0.0.1:8765";

async function clickVisibleContinue(page) {
  const buttons = page.getByTestId("button-continue");
  const n = await buttons.count();
  for (let i = n - 1; i >= 0; i--) {
    const b = buttons.nth(i);
    if (await b.isVisible()) {
      await b.click();
      return;
    }
  }
  throw new Error("No visible button-continue");
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });

  await page.goto(`${baseURL}/?cb=smoke-${Date.now()}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState("networkidle");

  const disclaimer = page.getByTestId("button-disclaimer-accept");
  if (await disclaimer.isVisible().catch(() => false)) {
    await disclaimer.click();
    await page.waitForLoadState("networkidle");
  }

  await page.getByTestId("button-get-started").click();
  await page.getByTestId("button-equipment-full_gym").click();
  await clickVisibleContinue(page);
  await page.getByTestId("button-goal-build_muscle").click();
  await clickVisibleContinue(page);
  await page.getByTestId("button-day-3").click();
  await page.getByTestId("button-next").click();
  await page.getByTestId("button-level-beginner").click();
  await clickVisibleContinue(page);

  await page.getByTestId("button-split-full-body").waitFor({ state: "visible", timeout: 20000 });
  console.log("Split screen OK");

  await page.getByTestId("button-split-full-body").click();
  await page.waitForTimeout(1500);

  const fatal = await page.getByText("App-Fehler (Debug)").isVisible().catch(() => false);
  const oldFatal = await page.getByText("Something went wrong").isVisible().catch(() => false);
  const schedule = await page.getByText("Your Schedule").isVisible().catch(() => false);

  console.log(JSON.stringify({
    baseURL,
    fatal,
    oldFatal,
    schedule,
    errors,
    pass: !fatal && !oldFatal && schedule,
  }, null, 2));

  await browser.close();
  process.exit(fatal || oldFatal || !schedule ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
