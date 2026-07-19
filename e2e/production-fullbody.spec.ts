import { test, expect, Page } from "@playwright/test";

async function acceptDisclaimerIfShown(page: Page) {
  const accept = page.getByTestId("button-disclaimer-accept");
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await page.waitForLoadState("networkidle");
  }
}

async function resetAppState(page: Page) {
  await page.goto("/?cb=e2e-" + Date.now());
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await acceptDisclaimerIfShown(page);
}

async function startOnboarding(page: Page) {
  await page.getByTestId("button-get-started").click({ timeout: 15000 });
  await expect(page.getByText("What equipment do you have?")).toBeVisible({
    timeout: 15000,
  });
}

async function clickVisibleContinue(page: Page) {
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

async function reachSplitSelection(page: Page) {
  await startOnboarding(page);
  await page.getByTestId("button-equipment-full_gym").click();
  await clickVisibleContinue(page);
  await page.getByTestId("button-goal-build_muscle").click();
  await clickVisibleContinue(page);
  await page.getByTestId("button-day-3").click();
  await page.getByTestId("button-next").click();
  await page.getByTestId("button-level-beginner").click();
  await clickVisibleContinue(page);
  await expect(page.getByTestId("button-split-full-body")).toBeVisible({
    timeout: 20000,
  });
}

test.describe("Production PWA — Full Body split", () => {
  test("clicking Full Body does not show error screen", async ({ page }) => {
    await resetAppState(page);
    await reachSplitSelection(page);

    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.getByTestId("button-split-full-body").click();

    await expect(page.getByText("App-Fehler (Debug)")).not.toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByText("Something went wrong")).not.toBeVisible({
      timeout: 1000,
    });

    await expect(page.getByText("Your Schedule")).toBeVisible({ timeout: 5000 });

    expect(consoleErrors).toEqual([]);
  });

  test("completing split selection reaches main app", async ({ page }) => {
    await resetAppState(page);
    await reachSplitSelection(page);

    await page.getByTestId("button-split-full-body").click();
    await expect(page.getByText("Your Schedule")).toBeVisible();

    await clickVisibleContinue(page);

    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("App-Fehler (Debug)")).not.toBeVisible();
    await expect(page.getByTestId("button-get-started")).not.toBeVisible();

    const plans = await page.evaluate(() => localStorage.getItem("workout_plans"));
    expect(plans).not.toBeNull();
  });

  test("FAB create plan flow works when onboarding complete", async ({ page }) => {
    await resetAppState(page);
    await reachSplitSelection(page);
    await page.getByTestId("button-split-full-body").click();
    await expect(page.getByText("Your Schedule")).toBeVisible({ timeout: 10000 });
    await clickVisibleContinue(page);

    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 20000 });

    const fab = page.getByTestId("button-fab-create");
    await expect(fab).toBeVisible({ timeout: 10000 });
    await fab.click();

    await page.getByTestId("input-plan-name").fill("E2E Test Plan");
    await page.getByTestId("button-day-3").click();
    await page.getByTestId("button-create-plan").click();

    await expect(page.getByText("App-Fehler (Debug)")).not.toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 15000 });
  });
});
