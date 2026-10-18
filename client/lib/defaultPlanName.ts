import i18n from "i18next";

const LEGACY_DEFAULT_NAME = "My Workout Plan";

/**
 * Name for a plan the user didn't name themselves. Plan generators live
 * outside React, so this reads the app-wide i18next instance directly; before
 * i18n is initialised (unit tests) it falls back to the English label.
 */
export function defaultPlanName(): string {
  return i18n.isInitialized
    ? i18n.t("plans.defaultPlanName", { defaultValue: LEGACY_DEFAULT_NAME })
    : LEGACY_DEFAULT_NAME;
}

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Display name for a stored plan. Plans generated before the default name was
 * localised were saved as the English "My Workout Plan" — show those in the
 * user's language instead. Any other name is the user's own and stays as-is.
 */
export function displayPlanName(t: TFunction, name: string): string {
  return name === LEGACY_DEFAULT_NAME
    ? t("plans.defaultPlanName", { defaultValue: LEGACY_DEFAULT_NAME })
    : name;
}
