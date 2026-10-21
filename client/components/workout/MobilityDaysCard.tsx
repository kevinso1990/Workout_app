import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import type { Palette } from "@/constants/palettes";
import { HEVY } from "@/constants/hevyLayout";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";
import { getUserPreferences, setUserPreferences } from "@/lib/storage";
import { ensureReminderPermission, syncMobilityReminders } from "@/lib/mobilityReminders";
import { MOBILITY_REMINDER_HOUR, MOBILITY_REMINDER_MINUTE } from "@/lib/mobilitySchedule";
import { toast } from "@/lib/toast";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Pick the fixed weekdays for the Mobility-Session; they drive the reminder. */
export function MobilityDaysCard({
  onChange,
  style,
}: {
  /** Called with the chosen weekdays once loaded and after every change. */
  onChange?: (weekdays: number[]) => void;
  style?: StyleProp<ViewStyle>;
} = {}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const { dayLabel } = useCommitmentLabels();
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    void getUserPreferences().then((p) => {
      const loaded = p?.mobilityWeekdays ?? [];
      setDays(loaded);
      onChange?.(loaded);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (weekday: number) => {
    Haptics.selectionAsync();
    const next = days.includes(weekday)
      ? days.filter((d) => d !== weekday)
      : [...days, weekday].sort((a, b) => a - b);
    setDays(next);
    onChange?.(next);

    const prefs = await getUserPreferences();
    await setUserPreferences({ workoutDaysPerWeek: 3, ...prefs, mobilityWeekdays: next });

    // Ask for notifications only when the first day is picked — that's the
    // moment the reminder starts to mean something to the user.
    if (days.length === 0 && next.length > 0) {
      const granted = await ensureReminderPermission();
      if (!granted) toast.info(t("mobility.permissionDenied"));
    }
    await syncMobilityReminders();
  };

  const time = `${MOBILITY_REMINDER_HOUR}:${String(MOBILITY_REMINDER_MINUTE).padStart(2, "0")}`;

  return (
    <View style={[styles.card, style]} testID="card-mobility-days">
      {/* Same header as the sport-days card it sits under in the profile. */}
      <View style={styles.titleRow}>
        <View style={[styles.iconTile, { backgroundColor: theme.ironElevated3 }]}>
          <Feather name="wind" size={20} color={theme.text} />
        </View>
        <View style={styles.titleCol}>
          <ThemedText style={styles.title}>{t("mobility.daysTitle")}</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
            {days.length > 0 ? t("mobility.daysHint", { time }) : t("mobility.daysEmptyHint")}
          </ThemedText>
        </View>
      </View>
      <View style={styles.dayRow}>
        {WEEKDAYS.map((d) => {
          const on = days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => void toggle(d)}
              style={[
                styles.day,
                on
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { borderColor: theme.controlOutline },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={dayLabel(d)}
              testID={`toggle-mobility-day-${d}`}
            >
              <ThemedText style={[styles.dayText, { color: on ? theme.onChalk : theme.text }]}>
                {dayLabel(d)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: HEVY.pad,
      marginTop: 8,
      padding: 16,
      gap: 12,
      borderRadius: 18,
      backgroundColor: c.ironElevated2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.hairline,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    titleCol: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      fontFamily: "Archivo_600SemiBold",
    },
    dayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 6,
    },
    day: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    dayText: {
      fontSize: 13,
      fontWeight: "700",
    },
    hint: {
      fontSize: 13,
    },
  });
