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
import { useOnboarding, FitnessLevel } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "FitnessLevel">;

const LEVELS: { id: FitnessLevel; title: string; description: string; icon: keyof typeof Feather.glyphMap }[] = [
  {
    id: "beginner",
    title: "Beginner",
    description: "New to working out or getting back after a break",
    icon: "target",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    description: "Consistent training for 6+ months",
    icon: "trending-up",
  },
  {
    id: "advanced",
    title: "Advanced",
    description: "2+ years of structured training",
    icon: "award",
  },
];

export default function FitnessLevelScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setFitnessLevel } = useOnboarding();

  const handleSelect = (level: FitnessLevel) => {
    Haptics.selectionAsync();
    setFitnessLevel(level);
  };

  const handleContinue = () => {
    if (state.fitnessLevel) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate("SplitSelection");
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { flex: 1, backgroundColor: theme.backgroundRoot, ...screenHeaderSafeAreaStyle(insets.top) },
      ]}
    >
      <ProgressBar showBrand step={4} total={4} style={{ marginBottom: Spacing.xl }} />
      <Animated.View entering={FadeInDown.duration(400)}>
        <OnboardingHeading
          title={t("onboarding.experienceQuestion")}
          subtitle={t("onboarding.experienceSubtitle")}
        />
      </Animated.View>

      <View style={styles.options}>
        {LEVELS.map((level, index) => {
          const isSelected = state.fitnessLevel === level.id;
          return (
            <Animated.View
              key={level.id}
              entering={FadeInDown.delay(100 + index * 100).duration(400)}
            >
              <Pressable
                onPress={() => handleSelect(level.id)}
                testID={`button-level-${level.id}`}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.backgroundDefault },
                  isSelected && { borderColor: Colors.light.primary, borderWidth: 2 },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: isSelected ? Colors.light.primary + "20" : theme.backgroundSecondary },
                  ]}
                >
                  <Feather
                    name={level.icon}
                    size={24}
                    color={isSelected ? Colors.light.primary : theme.textSecondary}
                  />
                </View>
                <View style={styles.optionContent}>
                  <ThemedText style={styles.optionTitle}>
                    {t(`onboarding.levelOptions.${level.id}.title`)}
                  </ThemedText>
                  <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                    {t(`onboarding.levelOptions.${level.id}.description`)}
                  </ThemedText>
                </View>
                {isSelected ? (
                  <Feather name="check-circle" size={24} color={Colors.light.primary} />
                ) : null}
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
            disabled={!state.fitnessLevel}
            style={[styles.continueWrapper, { opacity: state.fitnessLevel ? 1 : 0.5 }]}
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
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
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
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
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
