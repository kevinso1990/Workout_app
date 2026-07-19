import { CommonActions } from "@react-navigation/native";

import { rootNavigationRef } from "@/navigation/ActiveWorkoutRecovery";

/** Leaves onboarding/modals and shows the main tab navigator. */
export function resetToRootMain(): boolean {
  if (!rootNavigationRef.isReady()) {
    console.warn("[navigation] rootNavigationRef not ready for resetToRootMain");
    return false;
  }
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Main" }],
    }),
  );
  return true;
}
