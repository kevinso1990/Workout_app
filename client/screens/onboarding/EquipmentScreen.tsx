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
import { useOnboarding, Equipment } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Equipment">;

const EQUIPMENT_OPTIONS: {
  id: Equipment;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    id: "full_gym",
    title: "Full Gym Access",
    description: "Barbells, dumbbells, cables, machines",
    icon: "zap",
  },
  {
    id: "dumbbells_only",
    title: "Dumbbells Only",
    description: "Home setup with adjustable dumbbells",
    icon: "disc",
  },
  {
    id: "kettlebell",
    title: "Kettlebells Only",
    description: "Kettlebell-exclusive training",
    icon: "anchor",
  },
  {
    id: "home_minimal",
    title: "Minimal Equipment",
    description: "Pull-up bar, resistance bands",
    icon: "sliders",
  },
  {
    id: "bodyweight",
    title: "Bodyweight Only",
    description: "No equipment needed",
    icon: "user",
  },
];

function ProgressBar({ step, total }: { step: number; total: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            {
              backgroundColor:
                index < step ? Colors.light.primary : theme.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function EquipmentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setEquipment } = useOnboarding();

  const handleSelect = (equipment: Equipment) => {
    Haptics.selectionAsync();
    setEquipment(equipment);
  };

  const handleContinue = () => {
    if (state.equipment) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate("Goals");
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ProgressBar step={1} total={3} />

      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <ThemedText style={styles.title}>What equipment do you have?</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Tell us about your training environment
        </ThemedText>
      </Animated.View>

      <View style={styles.options}>
        {EQUIPMENT_OPTIONS.map((option, index) => {
          const isSelected = state.equipment === option.id;
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.delay(100 + index * 80).duration(400)}
            >
              <Pressable
                onPress={() => handleSelect(option.id)}
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
                  <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                  <ThemedText
                    style={[styles.optionDescription, { color: theme.textSecondary }]}
                  >
                    {option.description}
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
          disabled={!state.equipment}
          style={{ opacity: state.equipment ? 1 : 0.5 }}
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
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
