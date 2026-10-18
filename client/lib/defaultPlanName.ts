import i18n from "i18next";

/**
 * Name for a plan the user didn't name themselves. Plan generators live
 * outside React, so this reads the app-wide i18next instance directly; before
 * i18n is initialised (unit tests) it falls back to the English label.
 */
export function defaultPlanName(): string {
  return i18n.isInitialized
    ? i18n.t("plans.defaultPlanName", { defaultValue: "My Workout Plan" })
    : "My Workout Plan";
}
