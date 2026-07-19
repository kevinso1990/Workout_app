import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { toast, type ToastItem } from "@/lib/toast";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export function NativeToastHost() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => toast.subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: insets.top + Spacing.sm }]}
    >
      {toasts.map((t) => (
        <View
          key={t.id}
          style={[
            styles.toast,
            t.type === "success" && styles.success,
            t.type === "error" && styles.error,
            t.type === "offline" && styles.offline,
            t.type === "info" && styles.info,
          ]}
        >
          <Feather
            name={
              t.type === "success"
                ? "check-circle"
                : t.type === "error"
                ? "alert-circle"
                : "info"
            }
            size={16}
            color={Colors.light.primary}
          />
          <Text style={styles.message}>{t.message}</Text>
          <Pressable onPress={() => toast.dismiss(t.id)} hitSlop={8}>
            <Feather name="x" size={16} color={Colors.light.textSecondary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    backgroundColor: Colors.light.backgroundDefault,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  success: {
    borderColor: Colors.light.primary + "44",
    backgroundColor: Colors.light.primary + "12",
  },
  error: {
    borderColor: Colors.light.error + "44",
    backgroundColor: Colors.light.error + "12",
  },
  offline: {
    borderColor: Colors.light.border,
  },
  info: {
    borderColor: Colors.light.primary + "33",
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    fontFamily: "Montserrat_500Medium",
  },
});
