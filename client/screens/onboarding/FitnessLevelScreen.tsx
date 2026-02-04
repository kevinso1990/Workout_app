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
import { useOnboarding, FitnessLevel } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";

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
      navigation.navigate("Equipment");
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <ThemedText style={styles.title}>What's your experience level?</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          We'll customize your workouts accordingly
        </ThemedText>
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
                  <ThemedText style={styles.optionTitle}>{level.title}</ThemedText>
                  <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                    {level.description}
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
        <Pressable
          onPress={handleContinue}
          disabled={!state.fitnessLevel}
          style={{ opacity: state.fitnessLevel ? 1 : 0.5 }}
        >
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
    borderRadius: 24,
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
