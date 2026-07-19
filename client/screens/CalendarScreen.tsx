import React, { useCallback, useMemo, useState } from "react";
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
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
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
} from "@/lib/workoutCalendar";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

function formatMonthTitle(month: Date, locale: string): string {
  return month.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const { t } = useTranslation();
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
          { backgroundColor: cardio ? "#FEF3C7" : "#EEF2FF" },
        ]}
      >
        <Feather
          name={cardio ? "zap" : "activity"}
          size={18}
          color={cardio ? "#D97706" : Colors.light.primary}
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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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

  const monthStats = useMemo(() => {
    let strength = 0;
    let cardio = 0;
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    for (const [key, summary] of summaries) {
      if (!key.startsWith(prefix)) continue;
      strength += summary.strengthCount;
      cardio += summary.cardioCount;
    }
    return { strength, cardio };
  }, [summaries, month]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.lg),
          paddingBottom: tabBarHeight + 88,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ThemedText style={styles.heading}>{t("calendar.title")}</ThemedText>
        <ThemedText style={styles.subtitle}>{t("calendar.subtitle")}</ThemedText>

        <View style={styles.monthNav}>
          <Pressable
            onPress={() => setMonth((m) => addMonths(m, -1))}
            style={styles.navBtn}
            accessibilityLabel={t("calendar.prevMonth")}
          >
            <Feather name="chevron-left" size={22} color={Colors.light.primary} />
          </Pressable>
          <ThemedText style={styles.monthLabel}>
            {formatMonthTitle(month, i18n.language)}
          </ThemedText>
          <Pressable
            onPress={() => setMonth((m) => addMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel={t("calendar.nextMonth")}
          >
            <Feather name="chevron-right" size={22} color={Colors.light.primary} />
          </Pressable>
        </View>

        <HybridCalendar
          month={month}
          summaries={summaries}
          selectedDateKey={selectedDateKey}
          onSelectDate={handleSelectDate}
        />

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Feather name="activity" size={16} color={Colors.light.primary} />
            <ThemedText style={styles.statText}>
              {t("calendar.monthStrength", { count: monthStats.strength })}
            </ThemedText>
          </View>
          <View style={styles.statChip}>
            <Feather name="zap" size={16} color="#D97706" />
            <ThemedText style={styles.statText}>
              {t("calendar.monthCardio", { count: monthStats.cardio })}
            </ThemedText>
          </View>
        </View>
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
              <Feather name="plus" size={18} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F7" },
  heading: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: { fontSize: 17, fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
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
    borderBottomColor: "#E5E7EB",
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
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 14,
    marginTop: Spacing.lg,
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  secondaryBtnText: { color: Colors.light.primary, fontWeight: "600" },
});
