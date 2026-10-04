import React, { useMemo } from "react";
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
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useOnboarding } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import { AvoidExerciseEditor } from "@/components/AvoidExerciseEditor";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "AvoidExercises">;

/**
 * Exercises to exclude from every generated plan — a physio's "do not do"
 * list, or a movement that has caused pain before.
 *
 * Grouped with Commitments rather than Equipment/FitnessLevel: both are
 * boundaries the generator must respect, not preferences it can weigh. Most
 * people have nothing to add here, so — like Commitments — skipping is a
 * single tap, never a forced empty step.
 */
export default function AvoidExercisesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation<NavigationProp>();
  const { state, setAvoidExercises } = useOnboarding();

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Frequency");
  };

  const skip = () => {
    Haptics.selectionAsync();
    setAvoidExercises([]);
    navigation.navigate("Frequency");
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { flex: 1, backgroundColor: theme.backgroundRoot, ...screenHeaderSafeAreaStyle(insets.top) },
      ]}
    >
      <ProgressBar showBrand step={4} total={6} style={{ marginBottom: Spacing.lg }} />
      <Animated.View entering={FadeInDown.duration(400)}>
        <OnboardingHeading
          title={t("onboarding.avoidExercises.title", {
            defaultValue: "Übungen, die du vermeiden möchtest?",
          })}
          subtitle={t("onboarding.avoidExercises.subtitle", {
            defaultValue:
              "Zum Beispiel von deiner Physiotherapie, oder weil eine Übung dir schon einmal wehgetan hat. Dein Plan wird sie nie enthalten.",
          })}
        />
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.editorWrap}>
          <AvoidExerciseEditor value={state.avoidExercises} onChange={setAvoidExercises} />
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable onPress={skip} testID="button-avoid-skip" style={styles.skipButton}>
          <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
            {t("onboarding.avoidExercises.skip", { defaultValue: "Keine Einschränkungen" })}
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
            <View style={[styles.continueButton, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.continueText}>{t("onboarding.next")}</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { paddingHorizontal: Spacing.xl },
  scroll: { flex: 1 },
  editorWrap: { marginTop: Spacing.lg },
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
    backgroundColor: c.ironElevated2,
  },
  backText: { fontSize: 16, fontWeight: "600" },
  continueWrapper: { flex: 1 },
  continueButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  continueText: { fontSize: 16, fontWeight: "700", color: c.onChalk },
});
