import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
import { useOnboarding } from "@/context/OnboardingContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DAYS = [1, 2, 3, 4, 5, 6, 7];

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

function DayPill({
  day,
  selected,
  onPress,
}: {
  day: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      testID={`button-day-${day}`}
    >
      {selected ? (
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.dayPill}
        >
          <ThemedText style={styles.dayPillTextSelected}>{day}</ThemedText>
        </LinearGradient>
      ) : (
        <View
          style={[styles.dayPill, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText style={[styles.dayPillText, { color: theme.text }]}>
            {day}
          </ThemedText>
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
    navigation.navigate("SplitSelection");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View>
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <ProgressBar step={3} total={3} />
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(200).duration(500)}
            style={styles.questionContainer}
          >
            <ThemedText style={styles.question}>
              How many days per week{"\n"}do you want to gym?
            </ThemedText>
            <ThemedText
              style={[styles.hint, { color: theme.textSecondary }]}
            >
              Strength and weight training days
            </ThemedText>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(300).duration(500)}
            style={styles.pillsContainer}
          >
            {DAYS.map((day) => (
              <DayPill
                key={day}
                day={day}
                selected={state.workoutDaysPerWeek === day}
                onPress={() => handleDaySelect(day)}
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

        <Animated.View entering={FadeInUp.delay(500).duration(500)}>
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
            style={animatedButtonStyle}
            testID="button-next"
          >
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <ThemedText style={styles.buttonText}>Next</ThemedText>
            </LinearGradient>
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
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["4xl"],
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
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
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.md,
  },
  dayPill: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillText: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  dayPillTextSelected: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
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
