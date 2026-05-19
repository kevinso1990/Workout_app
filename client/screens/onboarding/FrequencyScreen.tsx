import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { useOnboarding } from "@/context/OnboardingContext";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DAYS = [
  { value: 1, label: "1x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x" },
  { value: 5, label: "5x" },
  { value: 6, label: "6x" },
  { value: 7, label: "7x" },
];

function DayPill({
  day,
  label,
  selected,
  onPress,
}: {
  day: number;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ flex: 1 }, animatedStyle]}
      testID={`button-day-${day}`}
    >
      {selected ? (
        <View style={[styles.dayPill, { backgroundColor: Colors.light.primary }]}>
          <ThemedText style={styles.dayPillNumberSelected}>{day}</ThemedText>
          <ThemedText style={styles.dayPillLabelSelected}>{label}</ThemedText>
        </View>
      ) : (
        <View
          style={[styles.dayPill, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText style={[styles.dayPillNumber, { color: theme.text }]}>{day}</ThemedText>
          <ThemedText style={[styles.dayPillLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function FrequencyScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, setWorkoutDays } = useOnboarding();
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleDaySelect = (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWorkoutDays(day);
  };

  const handleNext = () => {
    navigation.navigate("FitnessLevel");
  };

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.content,
          {
            ...screenHeaderSafeAreaStyle(insets.top),
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View>
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <ProgressBar showBrand step={3} total={4} style={{ marginBottom: Spacing.xl }} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <OnboardingHeading
              title={"How many days per week\ndo you want to train?"}
              subtitle="Strength and weight training days"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(300).duration(500)}
            style={styles.pillsContainer}
          >
            {DAYS.map(({ value, label }) => (
              <DayPill
                key={value}
                day={value}
                label={label}
                selected={state.workoutDaysPerWeek === value}
                onPress={() => handleDaySelect(value)}
              />
            ))}
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(400).duration(500)}
            style={styles.recommendationContainer}
          >
            <ThemedText
              style={[styles.recommendation, { color: theme.textSecondary }]}
            >
              {state.workoutDaysPerWeek <= 2
                ? "Great for beginners or busy schedules"
                : state.workoutDaysPerWeek <= 4
                  ? "Perfect balance for most fitness goals"
                  : state.workoutDaysPerWeek <= 5
                    ? "Ideal for building muscle and strength"
                    : "Advanced training for serious athletes"}
            </ThemedText>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.buttonsRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { borderColor: theme.border }]}
            testID="button-back"
          >
            <ThemedText style={[styles.backButtonText, { color: theme.text }]}>Back</ThemedText>
          </Pressable>
          <AnimatedPressable
            onPress={handleNext}
            onPressIn={() => {
              buttonScale.value = withSpring(0.96, {
                damping: 15,
                stiffness: 150,
              });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, {
                damping: 15,
                stiffness: 150,
              });
            }}
            style={[animatedButtonStyle, styles.nextButtonContainer]}
            testID="button-next"
          >
            <View style={[styles.button, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.buttonText}>Next</ThemedText>
            </View>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "space-between",
  },
  questionContainer: {
    marginBottom: Spacing["4xl"],
  },
  question: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  hint: {
    fontSize: 15,
    textAlign: "center",
  },
  pillsContainer: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  dayPill: {
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  dayPillNumber: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  dayPillNumberSelected: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  dayPillLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  dayPillLabelSelected: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "500",
  },
  recommendationContainer: {
    marginTop: Spacing["3xl"],
    alignItems: "center",
  },
  recommendation: {
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  buttonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  backButton: {
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  nextButtonContainer: {
    flex: 1,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
