import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://localhost:8081";

/**
 * Resets all onboarding-related storage so the Welcome screen is shown on reload.
 * The app uses AsyncStorage which maps to localStorage in the Expo web build.
 */
async function resetOnboardingState(page: Page) {
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("button-get-started")).toBeVisible({ timeout: 15000 });
}

/**
 * Asserts that a ProgressBar dot at the given index has the expected active state.
 * accessibilityValue={{ text: "active" | "inactive" }} maps to aria-valuetext in web.
 */
async function expectDotActive(page: Page, dotIndex: number, active: boolean) {
  const dot = page.getByTestId(`progress-dot-${dotIndex}`);
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute("aria-valuetext", active ? "active" : "inactive");
}

// ---------------------------------------------------------------------------
// Full onboarding flow
// ---------------------------------------------------------------------------

test.describe("Onboarding flow", () => {
  test("Welcome screen shows Get Started button", async ({ page }) => {
    await resetOnboardingState(page);
    await expect(page.getByTestId("button-get-started")).toBeVisible();
  });

  test("completes full onboarding sequence and navigates to main app", async ({
    page,
  }) => {
    await resetOnboardingState(page);

    // ── Screen 1: Welcome ──────────────────────────────────────────────────
    const getStartedBtn = page.getByTestId("button-get-started");
    await expect(getStartedBtn).toBeVisible();
    await getStartedBtn.click();

    // ── Screen 2: Equipment (ProgressBar step 1/4) ─────────────────────────
    await expect(page.getByText("What equipment do you have?")).toBeVisible();

    // ProgressBar step 1: dot 0 active, dots 1-3 inactive
    await expectDotActive(page, 0, true);
    for (let i = 1; i < 4; i++) {
      await expectDotActive(page, i, false);
    }

    // Select Full Gym and continue
    await page.getByTestId("button-equipment-full_gym").click();
    await page.getByTestId("button-continue").click();

    // ── Screen 3: Goals (ProgressBar step 2/4) ────────────────────────────
    await expect(page.getByText("What are your goals?")).toBeVisible();

    // ProgressBar step 2: dots 0-1 active, dots 2-3 inactive
    await expectDotActive(page, 0, true);
    await expectDotActive(page, 1, true);
    await expectDotActive(page, 2, false);

    // Select Build Muscle and continue
    await page.getByTestId("button-goal-build_muscle").click();
    await page.getByTestId("button-continue").click();

    // ── Screen 4: Frequency (ProgressBar step 3/4) ────────────────────────
    await expect(page.getByTestId("button-day-4")).toBeVisible();

    // ProgressBar step 3: dots 0-2 active, dot 3 inactive
    await expectDotActive(page, 0, true);
    await expectDotActive(page, 1, true);
    await expectDotActive(page, 2, true);
    await expectDotActive(page, 3, false);

    // Select 4 days/week and continue
    await page.getByTestId("button-day-4").click();
    await page.getByTestId("button-next").click();

    // ── Screen 5: FitnessLevel (ProgressBar step 4/4) ─────────────────────
    await expect(page.getByText("What's your experience level?")).toBeVisible();

    // ProgressBar step 4: all 4 dots active
    for (let i = 0; i < 4; i++) {
      await expectDotActive(page, i, true);
    }

    // Select Intermediate and continue
    await page.getByTestId("button-level-intermediate").click();
    await page.getByTestId("button-continue").click();

    // ── Screen 6: SplitSelection ───────────────────────────────────────────
    await expect(page.getByTestId("button-split-upper-lower")).toBeVisible();

    // Press "Create My Plan" (button-continue on SplitSelection)
    await page.getByTestId("button-continue").click();

    // ── Verify navigation to main app ─────────────────────────────────────
    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("button-get-started")).not.toBeVisible();

    // ── Verify plan was persisted in storage ──────────────────────────────
    // AsyncStorage maps directly to localStorage on web (no prefix).
    const onboardingComplete = await page.evaluate(() =>
      localStorage.getItem("onboarding_complete")
    );
    const workoutPlans = await page.evaluate(() =>
      localStorage.getItem("workout_plans")
    );
    expect(onboardingComplete).not.toBeNull();
    expect(workoutPlans).not.toBeNull();
    const plans = JSON.parse(workoutPlans!);
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThan(0);
  });

  test("ProgressBar shows the correct number of active dots on every screen", async ({
    page,
  }) => {
    await resetOnboardingState(page);
    await page.getByTestId("button-get-started").click();

    // Equipment — step 1
    await expect(page.getByText("What equipment do you have?")).toBeVisible();
    await expectDotActive(page, 0, true);
    for (let i = 1; i < 4; i++) await expectDotActive(page, i, false);

    await page.getByTestId("button-equipment-full_gym").click();
    await page.getByTestId("button-continue").click();

    // Goals — step 2
    await expect(page.getByText("What are your goals?")).toBeVisible();
    for (let i = 0; i < 2; i++) await expectDotActive(page, i, true);
    for (let i = 2; i < 4; i++) await expectDotActive(page, i, false);

    await page.getByTestId("button-goal-build_muscle").click();
    await page.getByTestId("button-continue").click();

    // Frequency — step 3
    await expect(page.getByTestId("button-day-3")).toBeVisible();
    for (let i = 0; i < 3; i++) await expectDotActive(page, i, true);
    await expectDotActive(page, 3, false);

    await page.getByTestId("button-day-3").click();
    await page.getByTestId("button-next").click();

    // FitnessLevel — step 4 (all 4 dots active)
    await expect(page.getByText("What's your experience level?")).toBeVisible();
    for (let i = 0; i < 4; i++) await expectDotActive(page, i, true);

    await page.getByTestId("button-level-beginner").click();
    await page.getByTestId("button-continue").click();

    // SplitSelection reached directly
    await expect(page.getByTestId("button-split-upper-lower")).toBeVisible();
  });

  test("Continue button on Equipment screen is disabled until a selection is made", async ({
    page,
  }) => {
    await resetOnboardingState(page);
    await page.getByTestId("button-get-started").click();

    await expect(page.getByText("What equipment do you have?")).toBeVisible();

    // Before any selection, tapping Continue should not advance the screen
    await page.getByTestId("button-continue").click({ force: true });
    await expect(page.getByText("What equipment do you have?")).toBeVisible();

    // After selection, Continue advances to Goals
    await page.getByTestId("button-equipment-dumbbells_only").click();
    await page.getByTestId("button-continue").click();
    await expect(page.getByText("What are your goals?")).toBeVisible();
  });

  test("Continue button on Goals screen is disabled until a goal is selected", async ({
    page,
  }) => {
    await resetOnboardingState(page);
    await page.getByTestId("button-get-started").click();
    await page.getByTestId("button-equipment-full_gym").click();
    await page.getByTestId("button-continue").click();

    await expect(page.getByText("What are your goals?")).toBeVisible();

    // Before selecting a goal, Continue should not advance
    await page.getByTestId("button-continue").click({ force: true });
    await expect(page.getByText("What are your goals?")).toBeVisible();

    // After selecting a goal, Continue advances
    await page.getByTestId("button-goal-get_stronger").click();
    await page.getByTestId("button-continue").click();
    await expect(page.getByTestId("button-day-3")).toBeVisible();
  });


  test("onboarding_complete flag is persisted so users never see onboarding again after completing it", async ({
    page,
  }) => {
    await resetOnboardingState(page);

    // ── Complete full onboarding naturally ────────────────────────────────
    await page.getByTestId("button-get-started").click();

    await expect(page.getByText("What equipment do you have?")).toBeVisible();
    await page.getByTestId("button-equipment-full_gym").click();
    await page.getByTestId("button-continue").click();

    await expect(page.getByText("What are your goals?")).toBeVisible();
    await page.getByTestId("button-goal-build_muscle").click();
    await page.getByTestId("button-continue").click();

    await expect(page.getByTestId("button-day-4")).toBeVisible();
    await page.getByTestId("button-day-4").click();
    await page.getByTestId("button-next").click();

    await expect(page.getByText("What's your experience level?")).toBeVisible();
    await page.getByTestId("button-level-intermediate").click();
    await page.getByTestId("button-continue").click();

    // Recommended split is pre-selected — tap Create Plan
    await expect(page.getByTestId("button-continue")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("button-continue").click();

    // Should land on main app, not Welcome screen
    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("button-get-started")).not.toBeVisible();

    // Verify the flag was actually written to storage
    const flagAfterComplete = await page.evaluate(() =>
      localStorage.getItem("onboarding_complete")
    );
    expect(flagAfterComplete).toBe("true");

    // ── Reload the app to simulate next launch ────────────────────────────
    await page.reload();
    await page.waitForLoadState("networkidle");

    // ── Verify onboarding is permanently skipped ──────────────────────────
    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("button-get-started")).not.toBeVisible();
    await expect(page.getByText("What equipment do you have?")).not.toBeVisible();

    // My Plans tab content should be present (plan created during onboarding exists)
    await expect(
      page.getByText(/My Plans|No Workout Plans Yet|Already have a workout plan\?/)
    ).toBeVisible({ timeout: 10000 });
  });

  test("returning user with onboarding_complete=true skips onboarding and lands on My Plans", async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // Seed onboarding_complete before the app reads it
    await page.evaluate(() => {
      localStorage.setItem("onboarding_complete", "true");
    });

    // Hard reload so RootStackNavigator picks up the flag
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Main tab should appear — wait generously for the async check to finish
    await expect(page.getByTestId("brand-logo")).toBeVisible({ timeout: 15000 });

    // Onboarding screens must not be visible
    await expect(page.getByTestId("button-get-started")).not.toBeVisible();
    await expect(page.getByText("What equipment do you have?")).not.toBeVisible();

    // My Plans tab content is present (empty-state or import banner)
    await expect(
      page.getByText(/No Workout Plans Yet|Already have a workout plan\?/)
    ).toBeVisible({ timeout: 10000 });
  });

  test("Back navigation returns to the previous screen", async ({ page }) => {
    await resetOnboardingState(page);

    await page.getByTestId("button-get-started").click();
    await expect(page.getByText("What equipment do you have?")).toBeVisible();

    // Advance to Goals
    await page.getByTestId("button-equipment-full_gym").click();
    await page.getByTestId("button-continue").click();
    await expect(page.getByText("What are your goals?")).toBeVisible();

    // Press Back — returns to Equipment screen
    await page.getByTestId("button-back").click();
    await expect(page.getByText("What equipment do you have?")).toBeVisible();
  });

});
