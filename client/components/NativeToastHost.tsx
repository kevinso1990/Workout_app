import React, { useEffect, useState, useMemo} from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { toast, type ToastItem } from "@/lib/toast";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";

export function NativeToastHost() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
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
            color={theme.primary}
          />
          <Text style={styles.message}>{t.message}</Text>
          <Pressable onPress={() => toast.dismiss(t.id)} hitSlop={8}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
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
    backgroundColor: c.backgroundDefault,
    borderColor: c.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  success: {
    borderColor: c.primary + "44",
    backgroundColor: c.primary + "12",
  },
  error: {
    borderColor: c.error + "44",
    backgroundColor: c.error + "12",
  },
  offline: {
    borderColor: c.border,
  },
  info: {
    borderColor: c.primary + "33",
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    fontFamily: "Montserrat_500Medium",
  },
});
