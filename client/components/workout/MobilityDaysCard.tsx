import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import type { Palette } from "@/constants/palettes";
import { HEVY } from "@/constants/hevyLayout";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";
import { getUserPreferences, setUserPreferences } from "@/lib/storage";
import { ensureReminderPermission, syncMobilityReminders } from "@/lib/mobilityReminders";
import { MOBILITY_REMINDER_HOUR, MOBILITY_REMINDER_MINUTE } from "@/lib/mobilitySchedule";
import { toast } from "@/lib/toast";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Pick the fixed weekdays for the Mobility-Session; they drive the reminder. */
export function MobilityDaysCard() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const { dayLabel } = useCommitmentLabels();
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    void getUserPreferences().then((p) => setDays(p?.mobilityWeekdays ?? []));
  }, []);

  const toggle = async (weekday: number) => {
    Haptics.selectionAsync();
    const next = days.includes(weekday)
      ? days.filter((d) => d !== weekday)
      : [...days, weekday].sort((a, b) => a - b);
    setDays(next);

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
    <View style={styles.card} testID="card-mobility-days">
      <View style={styles.titleRow}>
        <Feather name="bell" size={16} color={theme.text} />
        <ThemedText style={styles.title}>{t("mobility.daysTitle")}</ThemedText>
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
      <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
        {days.length > 0 ? t("mobility.daysHint", { time }) : t("mobility.daysEmptyHint")}
      </ThemedText>
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
      gap: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
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
      lineHeight: 18,
    },
  });
