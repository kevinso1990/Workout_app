import React, { useCallback, useMemo, useState} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { HybridCalendar } from "@/components/HybridCalendar";
import { CreatePlanFab } from "@/components/CreatePlanFab";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { Spacing, BorderRadius, Colors, FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import {
  getWorkoutHistory,
  isCardioSession,
  sessionDisplayTitle,
  type WorkoutSession,
} from "@/lib/storage";
import {
  addMonths,
  summarizeSessionsByDate,
  isoFromDateKey,
  dateKeyFromIso,
} from "@/lib/workoutCalendar";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { WeekScheduleStrip } from "@/components/schedule/WeekScheduleStrip";
import { getUserPreferences, getWorkoutPlans, type WorkoutPlan } from "@/lib/storage";
import type { WeeklyCommitment } from "@shared/weeklySchedule";

function formatMonthTitle(month: Date, locale: string): string {
  return month.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const cardio = isCardioSession(session);
  const title = sessionDisplayTitle(session);
  const time = new Date(session.completedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.sessionRow}>
      <View
        style={[
          styles.sessionIcon,
          { backgroundColor: theme.ironElevated2 },
        ]}
      >
        <ActivityIcon
          sport={cardio ? "running" : undefined}
          size={19}
          color={theme.chalk}
        />
      </View>
      <View style={styles.sessionBody}>
        <ThemedText style={styles.sessionTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={styles.sessionMeta}>
          {cardio
            ? t("calendar.cardioMeta", {
                minutes: session.cardio?.durationMinutes ?? session.duration ?? 0,
                rpe: session.cardio?.rpe ?? "—",
              })
            : t("calendar.strengthMeta", {
                day: session.dayName,
                count: session.exercises.length,
              })}
          {" · "}
          {time}
        </ThemedText>
      </View>
    </View>
  );
}

export default function CalendarScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [commitments, setCommitments] = useState<WeeklyCommitment[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  const summaries = useMemo(
    () => summarizeSessionsByDate(history),
    [history],
  );

  const selectedSessions = selectedDateKey
    ? summaries.get(selectedDateKey)?.sessions ?? []
    : [];

  const loadHistory = useCallback(async () => {
    const data = await getWorkoutHistory();
    setHistory(data.filter((s) => s.completedAt));
    // The week view shows what is COMING UP, which needs the plan and the
    // athlete's fixed sport days — the month grid only ever knew the past.
    const [prefs, loadedPlans] = await Promise.all([
      getUserPreferences(),
      getWorkoutPlans(),
    ]);
    setCommitments(prefs?.weeklyCommitments ?? []);
    setPlans(loadedPlans);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleSelectDate = (dateKey: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDateKey(dateKey);
    setDayModalVisible(true);
  };

  const openLogCardio = (dateKey?: string) => {
    setDayModalVisible(false);
    navigation.navigate("LogCardio", {
      prefilledDate: dateKey ?? selectedDateKey ?? undefined,
    });
  };

  const weekSessions = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    return history
      .filter((s) => {
        const d = new Date(s.completedAt);
        return d >= monday && d < sunday;
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
  }, [history]);

  const monthStats = useMemo(() => {
    let strength = 0;
    let cardio = 0;
    let activeDays = 0;
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    for (const [key, summary] of summaries) {
      if (!key.startsWith(prefix)) continue;
      strength += summary.strengthCount;
      cardio += summary.cardioCount;
      // Days trained, not sessions: two sessions in one day is still one day
      // of showing up, and that is the number worth looking at in a month view.
      if (summary.strengthCount > 0 || summary.cardioCount > 0) activeDays += 1;
    }
    return { strength, cardio, activeDays };
  }, [summaries, month]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.lg),
          paddingBottom: tabBarHeight + 128,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ThemedText style={styles.heading}>{t("calendar.title")}</ThemedText>
        <ThemedText style={styles.subtitle}>{t("calendar.subtitle")}</ThemedText>

        <View style={styles.segmented}>
          {(["week", "month"] as const).map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => {
                  Haptics.selectionAsync();
                  setViewMode(mode);
                }}
                testID={`calendar-view-${mode}`}
                style={[styles.segment, active && styles.segmentActive]}
              >
                <ThemedText
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                >
                  {mode === "week"
                    ? t("calendar.viewWeek", { defaultValue: "Woche" })
                    : t("calendar.viewMonth", { defaultValue: "Monat" })}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {viewMode === "week" ? (
          <>
            <WeekScheduleStrip
              commitments={commitments}
              sessionDayNames={(plans[0]?.days ?? []).map((d) => d.dayName)}
            />

            <ThemedText style={styles.sectionLabel}>
              {t("calendar.weekDone", { defaultValue: "Diese Woche absolviert" })}
            </ThemedText>

            {weekSessions.length === 0 ? (
              <View style={styles.emptyWeek}>
                <ThemedText style={styles.emptyWeekText}>
                  {t("calendar.weekEmpty", {
                    defaultValue: "Noch nichts geloggt — der erste Satz zählt.",
                  })}
                </ThemedText>
              </View>
            ) : (
              weekSessions.map((session) => (
                <Pressable
                  key={session.id}
                  onPress={() =>
                    handleSelectDate(dateKeyFromIso(session.completedAt))
                  }
                  style={styles.weekSessionRow}
                  testID={`calendar-week-session-${session.id}`}
                >
                  <View style={styles.sessionMark}>
                    <ActivityIcon
                      sport={isCardioSession(session) ? "running" : undefined}
                      size={17}
                      color={theme.chalk}
                    />
                  </View>
                  <View style={styles.sessionCopy}>
                    <ThemedText style={styles.weekSessionTitle}>
                      {sessionDisplayTitle(session)}
                    </ThemedText>
                    <ThemedText style={styles.weekSessionMeta}>
                      {new Date(session.completedAt).toLocaleDateString(i18n.language, {
                        weekday: "long",
                      })}
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={theme.chalkFaint}
                  />
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setMonth((m) => addMonths(m, -1))}
                style={styles.navBtn}
                accessibilityLabel={t("calendar.prevMonth")}
              >
                <Feather name="chevron-left" size={20} color={theme.chalk} />
              </Pressable>
              <ThemedText style={styles.monthLabel}>
                {formatMonthTitle(month, i18n.language)}
              </ThemedText>
              <Pressable
                onPress={() => setMonth((m) => addMonths(m, 1))}
                style={styles.navBtn}
                accessibilityLabel={t("calendar.nextMonth")}
              >
                <Feather name="chevron-right" size={20} color={theme.chalk} />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>{monthStats.strength}</ThemedText>
                <ThemedText style={styles.statLabel}>
                  {t("calendar.statStrength", { defaultValue: "Kraft" })}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>{monthStats.cardio}</ThemedText>
                <ThemedText style={styles.statLabel}>
                  {t("calendar.statCardio", { defaultValue: "Cardio" })}
                </ThemedText>
              </View>
              <View style={styles.statCard}>
                <ThemedText style={styles.statValue}>{monthStats.activeDays}</ThemedText>
                <ThemedText style={styles.statLabel}>
                  {t("calendar.statActiveDays", { defaultValue: "Aktive Tage" })}
                </ThemedText>
              </View>
            </View>

            <HybridCalendar
              month={month}
              summaries={summaries}
              selectedDateKey={selectedDateKey}
              onSelectDate={handleSelectDate}
            />

          </>
        )}
      </ScrollView>

      <CreatePlanFab />

      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setDayModalVisible(false)}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />
            <ThemedText style={styles.sheetTitle}>
              {selectedDateKey
                ? new Date(isoFromDateKey(selectedDateKey)).toLocaleDateString(
                    i18n.language,
                    { weekday: "long", day: "numeric", month: "long" },
                  )
                : ""}
            </ThemedText>

            {selectedSessions.length === 0 ? (
              <ThemedText style={styles.emptyDay}>{t("calendar.noSessions")}</ThemedText>
            ) : (
              selectedSessions.map((s) => <SessionRow key={s.id} session={s} />)
            )}

            <Pressable
              style={styles.primaryBtn}
              onPress={() => openLogCardio(selectedDateKey ?? undefined)}
            >
              <Feather name="plus" size={18} color={theme.onChalk} />
              <ThemedText style={styles.primaryBtnText}>
                {t("calendar.logCardioForDay")}
              </ThemedText>
            </Pressable>

            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                setDayModalVisible(false);
                navigation.navigate("StartWorkout", {});
              }}
            >
              <ThemedText style={styles.secondaryBtnText}>
                {t("addWorkout.startStrength")}
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.backgroundRoot },
  heading: { fontSize: 28, lineHeight: 34, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, opacity: 0.65, marginBottom: Spacing.lg },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.backgroundDefault,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: { fontSize: 17, fontWeight: "600" },
  segmented: {
    flexDirection: "row",
    backgroundColor: c.ironElevated,
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 3,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: c.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.chalkDim,
  },
  segmentTextActive: {
    color: c.onChalk,
  },
  sectionLabel: {
    fontSize: 12,
    color: c.chalkDim,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  emptyWeek: {
    backgroundColor: c.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyWeekText: {
    fontSize: 13,
    color: c.chalkDim,
    textAlign: "center",
  },
  weekSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: c.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sessionMark: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: c.ironElevated2,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionCopy: { flex: 1 },
  weekSessionTitle: { fontSize: 15, fontWeight: "600" },
  weekSessionMeta: { fontSize: 12, color: c.chalkDim, marginTop: 1 },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: c.backgroundDefault,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontFamily: FontFamily.display,
    color: c.chalk,
  },
  statLabel: {
    fontSize: 11,
    color: c.chalkDim,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  statText: { fontSize: 13, fontWeight: "500" },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.backgroundDefault,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.chalkFaint,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  emptyDay: { opacity: 0.6, marginBottom: Spacing.lg },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionBody: { flex: 1 },
  sessionTitle: { fontSize: 15, fontWeight: "600" },
  sessionMeta: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 14,
    marginTop: Spacing.lg,
  },
  primaryBtnText: { color: c.onChalk, fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  secondaryBtnText: { color: c.primary, fontWeight: "600" },
});
