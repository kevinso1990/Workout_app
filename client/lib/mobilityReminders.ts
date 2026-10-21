import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import i18n from "i18next";

import { getUserPreferences, getWorkoutHistory } from "@/lib/storage";
import {
  isMobilitySession,
  isSameLocalDay,
  mobilityReminderDates,
} from "@/lib/mobilitySchedule";

export const MOBILITY_REMINDER_KIND = "mobility-reminder";

/**
 * Re-plan the mobility reminders from scratch: drop every pending one, then
 * schedule the chosen weekdays for the next two weeks. Called on app start,
 * on every return to the foreground, after a workout is logged and after the
 * weekdays change — so "already stretched today" and the two-week horizon are
 * always current. Never prompts for permission; that happens when the user
 * picks their first mobility day.
 */
export async function syncMobilityReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.content.data?.kind === MOBILITY_REMINDER_KIND)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    const prefs = await getUserPreferences();
    const weekdays = prefs?.mobilityWeekdays ?? [];
    if (weekdays.length === 0) return;

    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    const now = new Date();
    const history = await getWorkoutHistory();
    const loggedToday = history.some(
      (s) => isSameLocalDay(new Date(s.completedAt), now) && isMobilitySession(s),
    );

    const dates = mobilityReminderDates(weekdays, now, loggedToday);
    for (const date of dates) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t("mobility.reminderTitle"),
          body: i18n.t("mobility.reminderBody"),
          sound: true,
          data: { kind: MOBILITY_REMINDER_KIND },
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date },
      });
    }
  } catch (err) {
    // Reminders are a convenience — never let them break app start or a save.
    console.warn("[mobilityReminders] sync failed", err);
  }
}

/** Ask once, when the user first opts into mobility days. */
export async function ensureReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}
