import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  setOnboardingComplete,
  setUserPreferences,
  saveWorkoutPlan,
  generateDefaultPlan,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  testID,
}: {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
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
      testID={testID}
    >
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: selected ? Colors.light.primary : theme.border,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: selected
                ? Colors.light.primary + "15"
                : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name={icon}
            size={28}
            color={selected ? Colors.light.primary : theme.textSecondary}
          />
        </View>
        <View style={styles.optionTextContainer}>
          <ThemedText style={styles.optionTitle}>{title}</ThemedText>
          <ThemedText
            style={[styles.optionDescription, { color: theme.textSecondary }]}
          >
            {description}
          </ThemedText>
        </View>
        <View
          style={[
            styles.radioOuter,
            {
              borderColor: selected ? Colors.light.primary : theme.border,
            },
          ]}
        >
          {selected ? (
            <View
              style={[
                styles.radioInner,
                { backgroundColor: Colors.light.primary },
              ]}
            />
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function ExercisePreferenceScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, setExercisePreference, getPreferences } = useOnboarding();
  const buttonScale = useSharedValue(1);
  const [isLoading, setIsLoading] = useState(false);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSelect = (preference: "choose" | "default") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercisePreference(preference);
  };

  const handleFinish = async () => {
    if (!state.exercisePreference) return;

    if (state.splitPreference === "choose") {
      navigation.navigate("SplitSelection");
      return;
    }

    setIsLoading(true);
    try {
      const preferences = getPreferences();
      if (preferences) {
        await setUserPreferences(preferences);

        if (preferences.exercisePreference === "default") {
          const defaultPlan = generateDefaultPlan(
            preferences.workoutDaysPerWeek
          );
          await saveWorkoutPlan(defaultPlan);
        }
      }

      await setOnboardingComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" as never }],
        })
      );
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const getButtonText = () => {
    if (state.splitPreference === "choose") {
      return "Choose Split";
    }
    return "Create My Plan";
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
              How would you like{"\n"}to pick exercises?
            </ThemedText>
            <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>
              Don't worry, you can swap exercises anytime
            </ThemedText>
          </Animated.View>

          <View style={styles.optionsContainer}>
            <Animated.View entering={FadeInUp.delay(300).duration(500)}>
              <OptionCard
                title="Use Defaults"
                description="Start with proven exercises for each muscle group"
                icon="check-circle"
                selected={state.exercisePreference === "default"}
                onPress={() => handleSelect("default")}
                testID="button-default"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(500)}>
              <OptionCard
                title="I'll Choose"
                description="Browse our exercise library and pick your favorites"
                icon="list"
                selected={state.exercisePreference === "choose"}
                onPress={() => handleSelect("choose")}
                testID="button-choose"
              />
            </Animated.View>
          </View>
        </View>

        <Animated.View
          entering={FadeInUp.delay(500).duration(500)}
          style={styles.buttonsRow}
        >
          <Pressable
            onPress={handleBack}
            style={[styles.backButton, { borderColor: theme.border }]}
            disabled={isLoading}
            testID="button-back"
          >
            <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
              Back
            </ThemedText>
          </Pressable>

          <AnimatedPressable
            onPress={handleFinish}
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
            disabled={!state.exercisePreference || isLoading}
            style={[
              animatedButtonStyle,
              styles.nextButtonContainer,
              { opacity: state.exercisePreference && !isLoading ? 1 : 0.5 },
            ]}
            testID="button-finish"
          >
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextButton}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.buttonText}>{getButtonText()}</ThemedText>
              )}
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
    marginBottom: Spacing["3xl"],
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
  optionsContainer: {
    gap: Spacing.lg,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
  nextButton: {
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
