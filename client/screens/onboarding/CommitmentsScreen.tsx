import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useOnboarding } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import type { CommitmentSport, Weekday, WeeklyCommitment } from "@shared/weeklySchedule";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Commitments">;

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const WEEKDAY_FALLBACK = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const SPORTS: { id: CommitmentSport; icon: keyof typeof Feather.glyphMap; fallback: string }[] = [
  { id: "running", icon: "wind", fallback: "Laufen" },
  { id: "football", icon: "circle", fallback: "Fußball" },
  { id: "basketball", icon: "target", fallback: "Basketball" },
  { id: "tennis", icon: "disc", fallback: "Tennis" },
  { id: "cycling", icon: "navigation", fallback: "Radfahren" },
  { id: "swimming", icon: "droplet", fallback: "Schwimmen" },
  { id: "boxing", icon: "shield", fallback: "Kampfsport" },
  { id: "custom", icon: "more-horizontal", fallback: "Anderes" },
];

/**
 * Fixed weekly commitments ("Tuesday basketball, Thursday jogging").
 *
 * This sits immediately before the frequency question on purpose: it changes
 * that question. Without it the app would ask for 1-7 gym days in a vacuum and
 * then silently cap the answer once the sport days are known, which reads as
 * the app overruling the athlete. Asked in this order, the next screen can
 * simply offer only the days that are actually free.
 *
 * Most people have nothing to declare, so "only the gym" is a single tap that
 * skips straight on — the previous cardio question in this flow was dropped for
 * being an unskippable step that changed nothing, and this must not repeat that.
 */
export default function CommitmentsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setWeeklyCommitments } = useOnboarding();

  const [pickerDay, setPickerDay] = useState<Weekday | null>(null);

  const commitments = state.weeklyCommitments;
  const dayLabel = (d: number) =>
    t(`onboarding.commitments.weekday.${WEEKDAY_KEYS[d]}`, { defaultValue: WEEKDAY_FALLBACK[d] });
  const sportLabel = (s: CommitmentSport) =>
    t(`onboarding.commitments.sport.${s}`, {
      defaultValue: SPORTS.find((x) => x.id === s)?.fallback ?? s,
    });

  const commitmentOn = (d: Weekday) => commitments.find((c) => c.weekday === d);

  const handleDayPress = (d: Weekday) => {
    Haptics.selectionAsync();
    if (commitmentOn(d)) {
      // Tapping a filled day clears it — no separate delete affordance needed.
      setWeeklyCommitments(commitments.filter((c) => c.weekday !== d));
      setPickerDay(null);
      return;
    }
    setPickerDay(pickerDay === d ? null : d);
  };

  const handlePickSport = (sport: CommitmentSport) => {
    if (pickerDay === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next: WeeklyCommitment = {
      id: `${pickerDay}-${sport}-${Date.now()}`,
      weekday: pickerDay,
      sport,
    };
    setWeeklyCommitments([...commitments.filter((c) => c.weekday !== pickerDay), next]);
    setPickerDay(null);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Frequency");
  };

  const skip = () => {
    Haptics.selectionAsync();
    setWeeklyCommitments([]);
    navigation.navigate("Frequency");
  };

  const freeDays = 7 - commitments.length;

  return (
    <ThemedView
      style={[
        styles.container,
        { flex: 1, backgroundColor: theme.backgroundRoot, ...screenHeaderSafeAreaStyle(insets.top) },
      ]}
    >
      <ProgressBar showBrand step={3} total={5} style={{ marginBottom: Spacing.lg }} />
      <Animated.View entering={FadeInDown.duration(400)}>
        <OnboardingHeading
          title={t("onboarding.commitments.title", {
            defaultValue: "Trainierst du außerhalb des Gyms?",
          })}
          subtitle={t("onboarding.commitments.subtitle", {
            defaultValue:
              "Tippe die Tage an, an denen du Sport hast. Dein Plan wird drumherum gelegt.",
          })}
        />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.weekRow}>
          {WEEKDAY_FALLBACK.map((_, i) => {
            const d = i as Weekday;
            const c = commitmentOn(d);
            const isPicking = pickerDay === d;
            return (
              <Pressable
                key={d}
                onPress={() => handleDayPress(d)}
                testID={`button-commitment-day-${d}`}
                style={[
                  styles.dayPill,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  c && { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
                  isPicking && { borderColor: Colors.light.primary, borderWidth: 2 },
                ]}
              >
                <ThemedText
                  style={[styles.dayPillText, c && { color: Colors.light.onChalk }]}
                >
                  {dayLabel(d)}
                </ThemedText>
              </Pressable>
            );
          })}
        </Animated.View>

        {pickerDay !== null ? (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.sportGrid}>
            {SPORTS.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => handlePickSport(s.id)}
                testID={`button-commitment-sport-${s.id}`}
                style={[
                  styles.sportChip,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                ]}
              >
                <Feather name={s.icon} size={16} color={theme.text} />
                <ThemedText style={styles.sportChipText}>{sportLabel(s.id)}</ThemedText>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}

        {commitments.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.summary}>
            {[...commitments]
              .sort((a, b) => a.weekday - b.weekday)
              .map((c) => (
                <View key={c.id} style={styles.summaryRow}>
                  <ThemedText style={styles.summaryDay}>{dayLabel(c.weekday)}</ThemedText>
                  <ThemedText style={[styles.summarySport, { color: theme.textSecondary }]}>
                    {sportLabel(c.sport)}
                  </ThemedText>
                </View>
              ))}
            <ThemedText style={[styles.freeDays, { color: theme.textSecondary }]}>
              {t("onboarding.commitments.freeDays", {
                count: freeDays,
                defaultValue: `${freeDays} Tage bleiben fürs Gym`,
              })}
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable onPress={skip} testID="button-commitments-skip" style={styles.skipButton}>
          <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
            {t("onboarding.commitments.skip", { defaultValue: "Nein, nur Gym" })}
          </ThemedText>
        </Pressable>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            testID="button-back"
            style={[styles.backButton, { borderColor: theme.border }]}
          >
            <ThemedText style={styles.backText}>{t("onboarding.back")}</ThemedText>
          </Pressable>
          <Pressable onPress={goNext} testID="button-continue" style={styles.continueWrapper}>
            <View style={[styles.continueButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.continueText}>{t("onboarding.next")}</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xl },
  scroll: { flex: 1 },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginTop: Spacing.lg,
  },
  dayPill: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  dayPillText: { fontSize: 13, fontWeight: "600" },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sportChipText: { fontSize: 14, fontWeight: "500" },
  summary: { marginTop: Spacing.xl, gap: Spacing.xs },
  summaryRow: { flexDirection: "row", gap: Spacing.md },
  summaryDay: { fontSize: 14, fontWeight: "700", width: 32 },
  summarySport: { fontSize: 14 },
  freeDays: { fontSize: 13, marginTop: Spacing.sm },
  footer: { gap: Spacing.md },
  skipButton: { alignItems: "center", paddingVertical: Spacing.sm },
  skipText: { fontSize: 15, fontWeight: "600" },
  footerRow: { flexDirection: "row", gap: Spacing.md },
  backButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: "center",
  },
  backText: { fontSize: 16, fontWeight: "600" },
  continueWrapper: { flex: 1 },
  continueButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  continueText: { fontSize: 16, fontWeight: "700", color: Colors.light.onChalk },
});
