import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { fetchRecoveryStatus, type RecoveryStatusRow } from "@/lib/recoveryApi";
import { translateMuscleGroup } from "@/lib/exerciseTaxonomy";
import { getDataSyncStatus, scheduleDataSync } from "@/lib/dataSync";

type RecoveryLevel = "ready" | "recovering" | "fatigued";

function levelFromPercent(percent: number): RecoveryLevel {
  if (percent > 70) return "ready";
  if (percent > 40) return "recovering";
  return "fatigued";
}

function levelColor(level: RecoveryLevel): string {
  if (level === "ready") return Colors.light.success;
  if (level === "recovering") return "#F59E0B";
  return Colors.light.error;
}

function hasServerFatigueData(rows: RecoveryStatusRow[]): boolean {
  return rows.some((r) => r.fatigue_score > 0 || r.recovery_percent < 100);
}

function isSyncStale(lastSuccessAt: string | null): boolean {
  if (!lastSuccessAt) return true;
  const ageMs = Date.now() - new Date(lastSuccessAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

type Props = {
  index?: number;
};

export function NativeRecoveryPanel({ index = 7 }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RecoveryStatusRow[]>([]);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setOffline(false);
    try {
      const data = await fetchRecoveryStatus();
      setRows(data);
    } catch {
      setRows([]);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const syncStatus = getDataSyncStatus();
  const hasData = hasServerFatigueData(rows);
  const showStaleNudge = hasData && isSyncStale(syncStatus.lastSuccessAt);

  const trained = rows
    .filter((r) => r.recovery_percent < 100)
    .sort((a, b) => a.recovery_percent - b.recovery_percent);

  const levelLabel = (level: RecoveryLevel) => {
    if (level === "ready") return t("recovery.ready");
    if (level === "recovering") return t("recovery.recovering");
    return t("recovery.fatigued");
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.sectionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <ThemedText style={styles.sectionTitle}>{t("recovery.title")}</ThemedText>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Colors.light.primary} />
            </View>
          ) : !hasData ? (
            <ThemedText style={[styles.placeholder, { color: theme.textSecondary }]}>
              {offline
                ? t("recovery.offline")
                : t("recovery.placeholder")}
            </ThemedText>
          ) : (
            <>
              {showStaleNudge ? (
                <Pressable
                  onPress={() => scheduleDataSync()}
                  style={[
                    styles.nudge,
                    {
                      backgroundColor: Colors.light.primary + "12",
                      borderColor: Colors.light.primary + "35",
                    },
                  ]}
                >
                  <Feather name="refresh-cw" size={14} color={Colors.light.primary} />
                  <ThemedText style={[styles.nudgeText, { color: theme.text }]}>
                    {t("recovery.syncNudge")}
                  </ThemedText>
                </Pressable>
              ) : null}

              <View style={styles.list}>
                {(trained.length > 0 ? trained : rows).map((row) => {
                  const level = levelFromPercent(row.recovery_percent);
                  const color = levelColor(level);
                  return (
                    <View key={row.muscle_group} style={styles.row}>
                      <View style={styles.rowTop}>
                        <ThemedText style={styles.muscleName}>
                          {translateMuscleGroup(t, row.muscle_group)}
                        </ThemedText>
                        <ThemedText style={[styles.levelBadge, { color }]}>
                          {levelLabel(level)}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.track,
                          { backgroundColor: color + "22" },
                        ]}
                      >
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${row.recovery_percent}%`,
                              backgroundColor: color,
                            },
                          ]}
                        />
                      </View>
                      <ThemedText
                        style={[styles.percent, { color: theme.textSecondary }]}
                      >
                        {row.recovery_percent}%
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  centered: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  placeholder: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  nudgeText: {
    flex: 1,
    fontSize: 13,
  },
  list: {
    gap: Spacing.md,
  },
  row: {
    gap: 6,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  muscleName: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
  percent: {
    fontSize: 11,
    textAlign: "right",
  },
});
