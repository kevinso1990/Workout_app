import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
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
  DEFAULT_EXERCISES,
  WorkoutDay,
  WorkoutPlan,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPLIT_OPTIONS = [
  {
    id: "push-pull-legs",
    name: "Push / Pull / Legs",
    description: "Classic 3-day split focusing on movement patterns",
    days: ["Push", "Pull", "Legs"],
    minDays: 3,
    icon: "layers",
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    description: "Efficient 2-day split for balanced development",
    days: ["Upper", "Lower"],
    minDays: 2,
    icon: "maximize-2",
  },
  {
    id: "full-body",
    name: "Full Body",
    description: "Hit every muscle group each session",
    days: ["Full Body"],
    minDays: 1,
    icon: "user",
  },
  {
    id: "bro-split",
    name: "Body Part Split",
    description: "Dedicate each day to specific muscle groups",
    days: ["Chest", "Back", "Shoulders", "Arms", "Legs"],
    minDays: 5,
    icon: "target",
  },
];

function SplitCard({
  split,
  selected,
  disabled,
  onPress,
  index,
}: {
  split: (typeof SPLIT_OPTIONS)[0];
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          animatedStyle,
          styles.splitCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: selected ? Colors.light.primary : theme.border,
            borderWidth: selected ? 2 : 1,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        testID={`button-split-${split.id}`}
      >
        <View
          style={[
            styles.splitIcon,
            {
              backgroundColor: selected
                ? Colors.light.primary + "15"
                : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name={split.icon as any}
            size={24}
            color={selected ? Colors.light.primary : theme.textSecondary}
          />
        </View>
        <View style={styles.splitInfo}>
          <ThemedText style={styles.splitName}>{split.name}</ThemedText>
          <ThemedText
            style={[styles.splitDescription, { color: theme.textSecondary }]}
          >
            {split.description}
          </ThemedText>
          <View style={styles.daysPreview}>
            {split.days.map((day, i) => (
              <View
                key={i}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected
                      ? Colors.light.primary + "20"
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayChipText,
                    {
                      color: selected
                        ? Colors.light.primary
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {day}
                </ThemedText>
              </View>
            ))}
          </View>
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
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function SplitSelectionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, getPreferences } = useOnboarding();
  const [selectedSplit, setSelectedSplit] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSplitSelect = (splitId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSplit(splitId);
  };

  const handleContinue = async () => {
    if (!selectedSplit) return;

    const selectedSplitOption = SPLIT_OPTIONS.find(
      (s) => s.id === selectedSplit
    );
    if (!selectedSplitOption) return;

    setIsLoading(true);
    try {
      const preferences = getPreferences();
      if (preferences) {
        await setUserPreferences(preferences);
      }

      const daysPerWeek = state.workoutDaysPerWeek;
      const splitDays: string[] = [];

      for (let i = 0; i < daysPerWeek; i++) {
        splitDays.push(
          selectedSplitOption.days[i % selectedSplitOption.days.length]
        );
      }

      const days: WorkoutDay[] = splitDays.map((dayName) => ({
        dayName,
        exercises:
          DEFAULT_EXERCISES[dayName] || DEFAULT_EXERCISES["Full Body"],
      }));

      const plan: WorkoutPlan = {
        id: Date.now().toString(),
        name: "My Workout Plan",
        daysPerWeek,
        days,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      await saveWorkoutPlan(plan);
      await setOnboardingComplete(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" as never }],
        })
      );
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <ThemedText style={styles.title}>Choose Your Split</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select a workout split for your {state.workoutDaysPerWeek}-day
            schedule
          </ThemedText>
        </Animated.View>

        <View style={styles.optionsContainer}>
          {SPLIT_OPTIONS.map((split, index) => (
            <SplitCard
              key={split.id}
              split={split}
              selected={selectedSplit === split.id}
              disabled={split.minDays > state.workoutDaysPerWeek}
              onPress={() => handleSplitSelect(split.id)}
              index={index}
            />
          ))}
        </View>

        {selectedSplit ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.previewSection}
          >
            <ThemedText style={styles.previewTitle}>Your Schedule</ThemedText>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              {(() => {
                const split = SPLIT_OPTIONS.find(
                  (s) => s.id === selectedSplit
                );
                if (!split) return null;
                const days = [];
                for (let i = 0; i < state.workoutDaysPerWeek; i++) {
                  days.push(split.days[i % split.days.length]);
                }
                return days.map((day, i) => (
                  <View key={i} style={styles.previewDay}>
                    <View
                      style={[
                        styles.previewDayNumber,
                        { backgroundColor: Colors.light.primary + "15" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.previewDayNumberText,
                          { color: Colors.light.primary },
                        ]}
                      >
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.previewDayName}>{day}</ThemedText>
                  </View>
                ));
              })()}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
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
          onPress={handleContinue}
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
          disabled={!selectedSplit || isLoading}
          style={[
            animatedButtonStyle,
            styles.continueButtonContainer,
            { opacity: selectedSplit && !isLoading ? 1 : 0.5 },
          ]}
          testID="button-continue"
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>Create Plan</ThemedText>
            )}
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing["2xl"],
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  splitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  splitIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  splitInfo: {
    flex: 1,
  },
  splitName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  splitDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  daysPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  dayChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewSection: {
    marginTop: Spacing["2xl"],
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.md,
  },
  previewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  previewDay: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewDayNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  previewDayNumberText: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewDayName: {
    fontSize: 15,
    fontWeight: "500",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.lg,
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
  continueButtonContainer: {
    flex: 1,
  },
  continueButton: {
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
