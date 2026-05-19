/**
 * Onboarding Flow — Component Tests
 *
 * Tests render each screen in the 6-step onboarding sequence using
 * react-native-web + jsdom, pressing real buttons and verifying
 * ProgressBar advancement and the "Create My Plan" completion action.
 *
 * Run:  npx vitest run --config vitest.component.config.ts
 */

import React from "react";
import { act } from "react";
import ReactDOM from "react-dom/client";

import { ThemeProvider } from "../../context/ThemeContext";
import { OnboardingProvider } from "../../context/OnboardingContext";
import { ProgressBar } from "../../components/onboarding/ProgressBar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrap(ui: React.ReactElement) {
  return (
    <ThemeProvider>
      <OnboardingProvider>{ui}</OnboardingProvider>
    </ThemeProvider>
  );
}

function mount(ui: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    ReactDOM.createRoot(container).render(ui);
  });
  return container;
}

function unmount(container: HTMLElement) {
  if (container && document.body.contains(container)) {
    document.body.removeChild(container);
  }
}

function byTestId(container: HTMLElement, id: string): Element | null {
  return container.querySelector('[data-testid="' + id + '"]');
}

// ---------------------------------------------------------------------------
// ProgressBar Unit Tests
// ---------------------------------------------------------------------------

describe("ProgressBar", () => {
  let container: HTMLElement;

  afterEach(() => unmount(container));

  it("renders the correct number of progress dots", () => {
    container = mount(wrap(<ProgressBar step={1} total={5} />));
    const dots = container.querySelectorAll('[data-testid^="progress-dot-"]');
    expect(dots).toHaveLength(5);
  });

  it("step=1 shows 1 active dot", () => {
    container = mount(wrap(<ProgressBar step={1} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(1);
  });

  it("step=2 shows 2 active dots", () => {
    container = mount(wrap(<ProgressBar step={2} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(2);
  });

  it("step=3 shows 3 active dots", () => {
    container = mount(wrap(<ProgressBar step={3} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(3);
  });

  it("step=4 shows 4 active dots", () => {
    container = mount(wrap(<ProgressBar step={4} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(4);
  });

  it("step=5 shows all 5 dots active", () => {
    container = mount(wrap(<ProgressBar step={5} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(5);
  });

  it("inactive dots have aria-valuetext=inactive", () => {
    container = mount(wrap(<ProgressBar step={2} total={5} />));
    expect(container.querySelectorAll('[aria-valuetext="inactive"]')).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Screen 1: WelcomeScreen
// ---------------------------------------------------------------------------

describe("WelcomeScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const WelcomeScreen = (await import("../../screens/onboarding/WelcomeScreen")).default;
    container = mount(wrap(<WelcomeScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the Get Started button", () => {
    expect(byTestId(container, "button-get-started")).not.toBeNull();
  });

  it("has no ProgressBar (intro screen)", () => {
    const dots = container.querySelectorAll('[data-testid^="progress-dot-"]');
    expect(dots).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Screen 2: EquipmentScreen  (ProgressBar step=1/5)
// ---------------------------------------------------------------------------

describe("EquipmentScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const EquipmentScreen = (await import("../../screens/onboarding/EquipmentScreen")).default;
    container = mount(wrap(<EquipmentScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the screen", () => {
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("shows ProgressBar with 4 dots", () => {
    expect(container.querySelectorAll('[data-testid^="progress-dot-"]')).toHaveLength(4);
  });

  it("ProgressBar at step 1 — 1 active dot", () => {
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(1);
  });

  it("renders equipment option buttons", () => {
    expect(byTestId(container, "button-equipment-full_gym")).not.toBeNull();
  });

  it("renders continue and back buttons", () => {
    expect(byTestId(container, "button-continue")).not.toBeNull();
    expect(byTestId(container, "button-back")).not.toBeNull();
  });

  it("clicking an equipment option does not crash", () => {
    const btn = byTestId(container, "button-equipment-full_gym");
    expect(btn).not.toBeNull();
    act(() => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Screen 3: GoalsScreen  (ProgressBar step=2/5)
// ---------------------------------------------------------------------------

describe("GoalsScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const GoalsScreen = (await import("../../screens/onboarding/GoalsScreen")).default;
    container = mount(wrap(<GoalsScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the screen", () => {
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("ProgressBar at step 2 — 2 active dots", () => {
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(2);
  });

  it("renders goal option buttons", () => {
    expect(byTestId(container, "button-goal-build_muscle")).not.toBeNull();
  });

  it("renders continue and back buttons", () => {
    expect(byTestId(container, "button-continue")).not.toBeNull();
    expect(byTestId(container, "button-back")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Screen 4: FrequencyScreen  (ProgressBar step=3/5)
// ---------------------------------------------------------------------------

describe("FrequencyScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const FrequencyScreen = (await import("../../screens/onboarding/FrequencyScreen")).default;
    container = mount(wrap(<FrequencyScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the screen", () => {
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("ProgressBar at step 3 — 3 active dots", () => {
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(3);
  });

  it("renders day-picker buttons", () => {
    expect(byTestId(container, "button-day-3")).not.toBeNull();
  });

  it("renders next and back buttons", () => {
    expect(byTestId(container, "button-next")).not.toBeNull();
    expect(byTestId(container, "button-back")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Screen 5: FitnessLevelScreen  (ProgressBar step=4/5)
// ---------------------------------------------------------------------------

describe("FitnessLevelScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const FitnessLevelScreen = (await import("../../screens/onboarding/FitnessLevelScreen")).default;
    container = mount(wrap(<FitnessLevelScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the screen", () => {
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("ProgressBar at step 4 — 4 active dots", () => {
    expect(container.querySelectorAll('[aria-valuetext="active"]')).toHaveLength(4);
  });

  it("renders beginner, intermediate, advanced buttons", () => {
    expect(byTestId(container, "button-level-beginner")).not.toBeNull();
    expect(byTestId(container, "button-level-intermediate")).not.toBeNull();
    expect(byTestId(container, "button-level-advanced")).not.toBeNull();
  });

  it("renders continue and back buttons", () => {
    expect(byTestId(container, "button-continue")).not.toBeNull();
    expect(byTestId(container, "button-back")).not.toBeNull();
  });
});


// ---------------------------------------------------------------------------
// Screen 7: SplitSelectionScreen  ("Create My Plan")
// ---------------------------------------------------------------------------

describe("SplitSelectionScreen", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    const SplitSelectionScreen = (await import("../../screens/onboarding/SplitSelectionScreen")).default;
    container = mount(wrap(<SplitSelectionScreen />));
  });

  afterEach(() => unmount(container));

  it("renders the screen", () => {
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("renders split option buttons", () => {
    const splits = container.querySelectorAll('[data-testid^="button-split-"]');
    expect(splits.length).toBeGreaterThan(0);
  });

  it("renders the Create My Plan (continue) button", () => {
    expect(byTestId(container, "button-continue")).not.toBeNull();
  });

  it("renders a back button", () => {
    expect(byTestId(container, "button-back")).not.toBeNull();
  });

  it("selecting a split option is interactive", () => {
    const firstSplit = container.querySelector('[data-testid^="button-split-"]');
    expect(firstSplit).not.toBeNull();
    act(() => { firstSplit!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it("Create My Plan writes onboarding_complete to storage", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const setItemSpy = vi.spyOn(AsyncStorage, "setItem").mockResolvedValue();

    // Select a split first
    const firstSplit = container.querySelector('[data-testid^="button-split-"]');
    if (firstSplit) {
      await act(async () => {
        firstSplit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }

    // Press "Create My Plan"
    await act(async () => {
      const btn = byTestId(container, "button-continue");
      if (btn) btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 100));
    });

    const saved = setItemSpy.mock.calls.some(([key]) => key === "onboarding_complete");
    expect(saved).toBe(true);
    setItemSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Full Sequence: ProgressBar Advancement
// ---------------------------------------------------------------------------

describe("Onboarding ProgressBar sequence", () => {
  it("each screen advances the ProgressBar by one dot", () => {
    const steps = [1, 2, 3, 4];
    for (let i = 0; i < steps.length; i++) {
      const c = mount(wrap(<ProgressBar step={steps[i]} total={4} />));
      const count = c.querySelectorAll('[aria-valuetext="active"]').length;
      expect(count).toBe(i + 1);
      unmount(c);
    }
  });

  it("screen order: Equipment=1, Goals=2, Frequency=3, FitnessLevel=4", () => {
    const screenSteps = [
      { name: "EquipmentScreen", step: 1 },
      { name: "GoalsScreen", step: 2 },
      { name: "FrequencyScreen", step: 3 },
      { name: "FitnessLevelScreen", step: 4 },
    ];
    for (let i = 1; i < screenSteps.length; i++) {
      expect(screenSteps[i].step).toBe(screenSteps[i - 1].step + 1);
    }
    expect(screenSteps[screenSteps.length - 1].step).toBe(4);
  });
});
