import { Alert, Platform } from "react-native";

/** Cross-platform confirm — RN Alert buttons are unreliable on web (Safari PWA). */
export function confirmAlert(
  title: string,
  message: string,
  options: {
    confirmText: string;
    cancelText: string;
    destructive?: boolean;
  },
): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const ok = window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(title, message, [
      { text: options.cancelText, style: "cancel", onPress: () => finish(false) },
      {
        text: options.confirmText,
        style: options.destructive ? "destructive" : "default",
        onPress: () => finish(true),
      },
    ]);
  });
}
