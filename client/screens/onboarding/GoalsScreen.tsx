import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
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
import { useOnboarding, FitnessGoal } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Goals">;

const GOAL_OPTIONS: {
  id: FitnessGoal;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    id: "build_muscle",
    title: "Build Muscle",
    description: "Gain size and definition",
    icon: "zap",
  },
  {
    id: "lose_fat",
    title: "Lose Fat",
    description: "Get leaner and more toned",
    icon: "trending-down",
  },
  {
    id: "get_stronger",
    title: "Get Stronger",
    description: "Increase lifts and power",
    icon: "trending-up",
  },
];

export default function GoalsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setFitnessGoals } = useOnboarding();

  const handleToggle = (goal: FitnessGoal) => {
    Haptics.selectionAsync();
    const currentGoals = state.fitnessGoals;
    if (currentGoals.includes(goal)) {
      setFitnessGoals(currentGoals.filter((g) => g !== goal));
    } else {
      setFitnessGoals([...currentGoals, goal]);
    }
  };

  const handleContinue = () => {
    if (state.fitnessGoals.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate("Frequency");
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { flex: 1, backgroundColor: theme.backgroundRoot, ...screenHeaderSafeAreaStyle(insets.top) },
      ]}
    >
      <ProgressBar showBrand step={2} total={4} style={{ marginBottom: Spacing.xl }} />

      <Animated.View entering={FadeInDown.duration(400)}>
        <OnboardingHeading
          title={t("onboarding.goalsTitle")}
          subtitle={t("onboarding.goalsSubtitle")}
        />
      </Animated.View>

      <View style={styles.options}>
        {GOAL_OPTIONS.map((option, index) => {
          const isSelected = state.fitnessGoals.includes(option.id);
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.delay(100 + index * 80).duration(400)}
            >
              <Pressable
                onPress={() => handleToggle(option.id)}
                testID={`button-goal-${option.id}`}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.backgroundDefault },
                  isSelected && { borderColor: Colors.light.primary, borderWidth: 2 },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isSelected
                        ? Colors.light.primary + "20"
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Feather
                    name={option.icon}
                    size={22}
                    color={isSelected ? Colors.light.primary : theme.textSecondary}
                  />
                </View>
                <View style={styles.optionContent}>
                  <ThemedText style={styles.optionTitle}>
                    {t(`onboarding.goalOptions.${option.id}.title`)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.optionDescription, { color: theme.textSecondary }]}
                  >
                    {t(`onboarding.goalOptions.${option.id}.description`)}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? Colors.light.primary : "transparent",
                      borderColor: isSelected ? Colors.light.primary : theme.textSecondary,
                    },
                  ]}
                >
                  {isSelected ? (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            testID="button-back"
            style={[styles.backButton, { borderColor: "#E8E8E8" }]}
          >
            <ThemedText style={styles.backText}>{t("onboarding.back")}</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleContinue}
            testID="button-continue"
            disabled={state.fitnessGoals.length === 0}
            style={[styles.continueWrapper, { opacity: state.fitnessGoals.length > 0 ? 1 : 0.5 }]}
          >
            <View style={[styles.continueButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.continueText}>{t("onboarding.next")}</ThemedText>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  options: {
    flex: 1,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  backButton: {
    height: 54,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  continueWrapper: {
    flex: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
