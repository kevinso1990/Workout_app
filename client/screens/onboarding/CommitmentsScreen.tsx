import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { HEVY } from "@/constants/hevyLayout";
import { useOnboarding } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import { CommitmentEditor } from "@/components/schedule/CommitmentEditor";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Commitments">;

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

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Frequency");
  };

  const skip = () => {
    Haptics.selectionAsync();
    setWeeklyCommitments([]);
    navigation.navigate("Frequency");
  };

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
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.editorWrap}>
          <CommitmentEditor
            commitments={state.weeklyCommitments}
            onChange={setWeeklyCommitments}
          />
          {state.weeklyCommitments.length > 0 ? (
            <ThemedText style={[styles.freeDays, { color: theme.textSecondary }]}>
              {t("onboarding.commitments.freeDays", {
                count: 7 - state.weeklyCommitments.length,
                defaultValue: `${7 - state.weeklyCommitments.length} Tage bleiben fürs Gym`,
              })}
            </ThemedText>
          ) : null}
        </Animated.View>
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
  editorWrap: { marginTop: Spacing.lg },
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
    backgroundColor: HEVY.surface,
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
