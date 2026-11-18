import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { rootNavigationRef } from "@/navigation/ActiveWorkoutRecovery";
import {
  MOBILITY_REMINDER_KIND,
  syncMobilityReminders,
} from "@/lib/mobilityReminders";
import { mobilityReminderPlanId } from "@/lib/mobilitySplit";
import { getWorkoutPlans } from "@/lib/storage";

async function openMobilityPlan(response: Notifications.NotificationResponse | null) {
  if (response?.notification.request.content.data?.kind !== MOBILITY_REMINDER_KIND) return;
  if (!rootNavigationRef.isReady()) return;
  const planId = mobilityReminderPlanId(await getWorkoutPlans());
  if (planId) rootNavigationRef.navigate("PlanDetail", { planId });
  else rootNavigationRef.navigate("Main");
}

/**
 * Keeps the mobility reminders current (app start + every return to the
 * foreground) and opens the Mobility-Session when one is tapped.
 */
export function MobilityReminderSync({ bootstrapReady }: { bootstrapReady: boolean }) {
  useEffect(() => {
    if (!bootstrapReady || Platform.OS === "web") return;

    void syncMobilityReminders();
    // Cold start from a tapped reminder.
    void Notifications.getLastNotificationResponseAsync().then(openMobilityPlan);

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncMobilityReminders();
    });
    const tap = Notifications.addNotificationResponseReceivedListener(openMobilityPlan);
    return () => {
      appState.remove();
      tap.remove();
    };
  }, [bootstrapReady]);

  return null;
}
