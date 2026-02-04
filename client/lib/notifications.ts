import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWorkoutHistory } from "./storage";

const REMINDER_SETTINGS_KEY = "@fitplan_reminder_settings";

export interface ReminderSettings {
  enabled: boolean;
  preferredTime: string;
  weekdays: number[];
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  preferredTime: "09:00",
  weekdays: [1, 2, 3, 4, 5],
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const value = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
    return value ? { ...DEFAULT_SETTINGS, ...JSON.parse(value) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, JSON.stringify(settings));
}

export async function analyzeWorkoutPatterns(): Promise<{
  suggestedDays: number[];
  averageFrequency: number;
  lastWorkoutDaysAgo: number;
}> {
  const history = await getWorkoutHistory();
  const now = new Date();
  
  if (history.length === 0) {
    return {
      suggestedDays: [1, 3, 5],
      averageFrequency: 0,
      lastWorkoutDaysAgo: -1,
    };
  }

  const workoutDates = history.map(w => new Date(w.completedAt));
  const daysCounts: Record<number, number> = {};
  
  workoutDates.forEach(date => {
    const day = date.getDay();
    daysCounts[day] = (daysCounts[day] || 0) + 1;
  });

  const sortedDays = Object.entries(daysCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([day]) => parseInt(day));

  const gaps: number[] = [];
  for (let i = 1; i < workoutDates.length; i++) {
    const diff = (workoutDates[i - 1].getTime() - workoutDates[i].getTime()) / (1000 * 60 * 60 * 24);
    gaps.push(diff);
  }
  const averageFrequency = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  const lastWorkoutDaysAgo = Math.floor(
    (now.getTime() - workoutDates[0].getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    suggestedDays: sortedDays.length > 0 ? sortedDays : [1, 3, 5],
    averageFrequency: Math.round(averageFrequency * 10) / 10,
    lastWorkoutDaysAgo,
  };
}

export async function scheduleWorkoutReminders(settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!settings.enabled || Platform.OS === "web") {
    return;
  }

  const [hours, minutes] = settings.preferredTime.split(":").map(Number);
  const messages = [
    "Time to get those gains! Your workout awaits.",
    "Ready to crush it? Your workout is calling!",
    "Let's build some strength today!",
    "Your muscles are ready for action!",
    "Consistency is key. Time to train!",
  ];

  for (const weekday of settings.weekdays) {
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Workout Reminder",
        body: message,
        data: { type: "workout_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday === 0 ? 1 : weekday + 1,
        hour: hours,
        minute: minutes,
      },
    });
  }
}

export async function sendSmartReminder(): Promise<void> {
  const { lastWorkoutDaysAgo, averageFrequency } = await analyzeWorkoutPatterns();
  
  if (lastWorkoutDaysAgo >= 0 && averageFrequency > 0) {
    const shouldRemind = lastWorkoutDaysAgo >= Math.max(averageFrequency, 2);
    
    if (shouldRemind && Platform.OS !== "web") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time to Train?",
          body: `It's been ${lastWorkoutDaysAgo} days since your last workout. Ready to get back at it?`,
          data: { type: "smart_reminder" },
        },
        trigger: null,
      });
    }
  }
}

export function getDayName(dayIndex: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dayIndex] || "";
}
