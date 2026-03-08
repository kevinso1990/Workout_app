const ONBOARDING_KEY = "workoutapp_onboarding_done";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {}
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {}
}
