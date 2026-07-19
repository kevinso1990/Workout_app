import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

async function run(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await fn();
  } catch {
    /* native haptics unavailable */
  }
}

export function hapticLight(): void {
  void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium(): void {
  void run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticSelection(): void {
  void run(() => Haptics.selectionAsync());
}

export function hapticSuccess(): void {
  void run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function hapticError(): void {
  void run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}

export function hapticWarning(): void {
  void run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}
