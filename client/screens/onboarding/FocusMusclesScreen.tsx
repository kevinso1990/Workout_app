import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useOnboarding, MuscleGroup } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "FocusMuscles">;

const MUSCLE_OPTIONS: { id: MuscleGroup; title: string }[] = [
  { id: "chest", title: "Chest" },
  { id: "back", title: "Back" },
  { id: "shoulders", title: "Shoulders" },
  { id: "arms", title: "Arms" },
  { id: "legs", title: "Legs" },
  { id: "core", title: "Core" },
];

export default function FocusMusclesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setFocusMuscles } = useOnboarding();

  const handleToggle = (muscle: MuscleGroup) => {
    Haptics.selectionAsync();
    const currentMuscles = state.focusMuscles;
    if (currentMuscles.includes(muscle)) {
      setFocusMuscles(currentMuscles.filter((m) => m !== muscle));
    } else {
      setFocusMuscles([...currentMuscles, muscle]);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Frequency");
  };

  const handleSkip = () => {
    navigation.navigate("Frequency");
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <ThemedText style={styles.title}>Focus areas?</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select muscles you want to prioritize (optional)
        </ThemedText>
      </Animated.View>

      <View style={styles.options}>
        {MUSCLE_OPTIONS.map((option, index) => {
          const isSelected = state.focusMuscles.includes(option.id);
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.delay(100 + index * 60).duration(400)}
              style={styles.optionWrapper}
            >
              <Pressable
                onPress={() => handleToggle(option.id)}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.backgroundDefault },
                  isSelected && { borderColor: Colors.light.primary, backgroundColor: Colors.light.primary + "10" },
                ]}
              >
                <ThemedText
                  style={[
                    styles.optionTitle,
                    isSelected && { color: Colors.light.primary },
                  ]}
                >
                  {option.title}
                </ThemedText>
                {isSelected ? (
                  <Feather name="check" size={18} color={Colors.light.primary} />
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
            Skip for now
          </ThemedText>
        </Pressable>
        <Pressable onPress={handleContinue}>
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            style={styles.continueButton}
          >
            <ThemedText style={styles.continueText}>Continue</ThemedText>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  optionWrapper: {
    width: "47%",
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    gap: Spacing.sm,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  footer: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontSize: 15,
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
