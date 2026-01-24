import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  getWorkoutPlans,
  WorkoutPlan,
  Exercise,
  addWorkoutSession,
  getWorkoutHistory,
  WorkoutSession,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ActiveWorkoutRouteProp = RouteProp<RootStackParamList, "ActiveWorkout">;

type SetRating = "green" | "yellow" | "red" | null;

interface SetData {
  weight: string;
  reps: string;
  rating: SetRating;
  completed: boolean;
}

interface ExerciseProgress {
  exerciseId: string;
  sets: SetData[];
}

const RATING_COLORS = {
  green: "#22C55E",
  yellow: "#F59E0B",
  red: "#EF4444",
};

function RatingButton({
  rating,
  selected,
  onPress,
  disabled,
}: {
  rating: "green" | "yellow" | "red";
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

  const labels = {
    green: "Easy",
    yellow: "Good",
    red: "Hard",
  };

  const icons = {
    green: "smile",
    yellow: "meh",
    red: "frown",
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[
        animatedStyle,
        styles.ratingButton,
        {
          backgroundColor: selected
            ? RATING_COLORS[rating]
            : RATING_COLORS[rating] + "20",
          borderColor: RATING_COLORS[rating],
          borderWidth: selected ? 0 : 2,
        },
      ]}
      testID={`button-rating-${rating}`}
    >
      <Feather
        name={icons[rating] as any}
        size={24}
        color={selected ? "#FFFFFF" : RATING_COLORS[rating]}
      />
      <ThemedText
        style={[
          styles.ratingText,
          { color: selected ? "#FFFFFF" : RATING_COLORS[rating] },
        ]}
      >
        {labels[rating]}
      </ThemedText>
    </AnimatedPressable>
  );
}

function SetInput({
  setIndex,
  setData,
  lastWeekData,
  onUpdate,
  onComplete,
  isActive,
}: {
  setIndex: number;
  setData: SetData;
  lastWeekData: { weight: string; reps: string; rating: SetRating } | null;
  onUpdate: (data: Partial<SetData>) => void;
  onComplete: () => void;
  isActive: boolean;
}) {
  const { theme } = useTheme();
  const weightRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);

  const handleRating = (rating: SetRating) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdate({ rating, completed: true });
    onComplete();
  };

  const canRate = setData.weight.trim() !== "" && setData.reps.trim() !== "";

  if (!isActive && !setData.completed) {
    return (
      <View style={[styles.setRowInactive, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={[styles.setNumber, { backgroundColor: theme.border }]}>
          <ThemedText style={[styles.setNumberText, { color: theme.textSecondary }]}>
            {setIndex + 1}
          </ThemedText>
        </View>
        <ThemedText style={[styles.upcomingText, { color: theme.textSecondary }]}>
          Set {setIndex + 1}
        </ThemedText>
      </View>
    );
  }

  if (setData.completed) {
    return (
      <View style={[styles.setRowCompleted, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={[styles.setNumber, { backgroundColor: Colors.light.primary }]}>
          <Feather name="check" size={14} color="#FFFFFF" />
        </View>
        <ThemedText style={styles.completedSetText}>
          {setData.weight}kg x {setData.reps} reps
        </ThemedText>
        {setData.rating ? (
          <View
            style={[
              styles.completedRating,
              { backgroundColor: RATING_COLORS[setData.rating] },
            ]}
          />
        ) : null}
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      style={[styles.activeSetContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.activeSetHeader}>
        <View style={[styles.setNumberLarge, { backgroundColor: Colors.light.primary }]}>
          <ThemedText style={styles.setNumberLargeText}>{setIndex + 1}</ThemedText>
        </View>
        <View style={styles.activeSetInfo}>
          <ThemedText style={styles.activeSetTitle}>Set {setIndex + 1}</ThemedText>
          {lastWeekData ? (
            <View style={styles.lastWeekBadge}>
              <ThemedText style={[styles.lastWeekLabel, { color: theme.textSecondary }]}>
                Last time: {lastWeekData.weight}kg x {lastWeekData.reps}
              </ThemedText>
              {lastWeekData.rating ? (
                <View
                  style={[
                    styles.lastWeekRatingDot,
                    { backgroundColor: RATING_COLORS[lastWeekData.rating] },
                  ]}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.inputsRow}>
        <View style={styles.inputWrapper}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Weight
          </ThemedText>
          <View style={[styles.inputBox, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              ref={weightRef}
              style={[styles.inputText, { color: theme.text }]}
              value={setData.weight}
              onChangeText={(text) => onUpdate({ weight: text })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              onSubmitEditing={() => repsRef.current?.focus()}
              testID={`input-weight-${setIndex}`}
            />
            <ThemedText style={[styles.inputUnit, { color: theme.textSecondary }]}>
              kg
            </ThemedText>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Reps
          </ThemedText>
          <View style={[styles.inputBox, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              ref={repsRef}
              style={[styles.inputText, { color: theme.text }]}
              value={setData.reps}
              onChangeText={(text) => onUpdate({ reps: text })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID={`input-reps-${setIndex}`}
            />
          </View>
        </View>
      </View>

      <View style={styles.ratingSection}>
        <ThemedText style={[styles.ratingQuestion, { color: theme.text }]}>
          How did it feel?
        </ThemedText>
        <View style={styles.ratingButtonsRow}>
          <RatingButton
            rating="red"
            selected={setData.rating === "red"}
            onPress={() => handleRating("red")}
            disabled={!canRate}
          />
          <RatingButton
            rating="yellow"
            selected={setData.rating === "yellow"}
            onPress={() => handleRating("yellow")}
            disabled={!canRate}
          />
          <RatingButton
            rating="green"
            selected={setData.rating === "green"}
            onPress={() => handleRating("green")}
            disabled={!canRate}
          />
        </View>
        {!canRate ? (
          <ThemedText style={[styles.ratingHint, { color: theme.textSecondary }]}>
            Enter weight and reps first
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ActiveWorkoutRouteProp>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [progress, setProgress] = useState<ExerciseProgress[]>([]);
  const [lastWeekProgress, setLastWeekProgress] = useState<ExerciseProgress[]>([]);
  const [startTime] = useState(Date.now());
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plans, history] = await Promise.all([
        getWorkoutPlans(),
        getWorkoutHistory(),
      ]);

      const targetPlan = plans.find((p) => p.id === route.params.planId);
      if (!targetPlan) return;

      setPlan(targetPlan);
      const day = targetPlan.days[route.params.dayIndex];

      const initialProgress: ExerciseProgress[] = day.exercises.map((ex) => ({
        exerciseId: ex.id,
        sets: Array.from({ length: ex.sets }, () => ({
          weight: "",
          reps: "",
          rating: null,
          completed: false,
        })),
      }));
      setProgress(initialProgress);

      const lastSession = history.find(
        (s) => s.planId === targetPlan.id && s.dayName === day.dayName
      );
      if (lastSession?.exerciseProgress) {
        setLastWeekProgress(lastSession.exerciseProgress);
      }
    } catch (error) {
      console.error("Error loading:", error);
    }
  };

  const handleUpdateSet = (data: Partial<SetData>) => {
    setProgress((prev) => {
      const updated = [...prev];
      updated[currentExerciseIndex] = {
        ...updated[currentExerciseIndex],
        sets: updated[currentExerciseIndex].sets.map((s, i) =>
          i === currentSetIndex ? { ...s, ...data } : s
        ),
      };
      return updated;
    });
  };

  const handleSetComplete = () => {
    if (!plan) return;
    const day = plan.days[route.params.dayIndex];
    const currentExercise = day.exercises[currentExerciseIndex];
    const exerciseProgress = progress[currentExerciseIndex];

    if (currentSetIndex < currentExercise.sets - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < day.exercises.length - 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const handleNextExercise = () => {
    if (!plan) return;
    const day = plan.days[route.params.dayIndex];
    
    if (currentExerciseIndex < day.exercises.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentExerciseIndex(currentExerciseIndex - 1);
      setCurrentSetIndex(0);
    }
  };

  const handleFinishWorkout = async () => {
    if (!plan) return;

    const totalSets = progress.reduce((acc, ex) => acc + ex.sets.length, 0);
    const completedSets = progress.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );

    if (completedSets < totalSets) {
      Alert.alert(
        "Incomplete Workout",
        `You've completed ${completedSets} of ${totalSets} sets. Finish anyway?`,
        [
          { text: "Keep Going", style: "cancel" },
          { text: "Finish", onPress: () => saveAndExit() },
        ]
      );
    } else {
      saveAndExit();
    }
  };

  const saveAndExit = async () => {
    if (!plan) return;

    const day = plan.days[route.params.dayIndex];
    const session: WorkoutSession = {
      id: Date.now().toString(),
      planId: plan.id,
      planName: plan.name,
      dayName: day.dayName,
      completedAt: new Date().toISOString(),
      exercises: day.exercises,
      exerciseProgress: progress,
      duration: Math.floor((Date.now() - startTime) / 1000),
    };

    await addWorkoutSession(session);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  if (!plan || progress.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const day = plan.days[route.params.dayIndex];
  const currentExercise = day.exercises[currentExerciseIndex];
  const exerciseProgress = progress[currentExerciseIndex];
  const lastWeekExercise = lastWeekProgress[currentExerciseIndex];

  const totalSets = progress.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = progress.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const isLastExercise = currentExerciseIndex === day.exercises.length - 1;
  const exerciseComplete = exerciseProgress.sets.every((s) => s.completed);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.md,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          <View style={styles.headerTop}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              testID="button-back"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.headerInfo}>
              <ThemedText style={styles.dayTitle}>{day.dayName}</ThemedText>
              <ThemedText style={[styles.planLabel, { color: theme.textSecondary }]}>
                {plan.name}
              </ThemedText>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
              >
                <LinearGradient
                  colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>
            </View>
            <ThemedText style={[styles.progressLabel, { color: theme.textSecondary }]}>
              {completedSets}/{totalSets}
            </ThemedText>
          </View>
        </View>

        <View style={styles.exerciseNavigation}>
          <Pressable
            onPress={handlePreviousExercise}
            disabled={currentExerciseIndex === 0}
            style={[
              styles.navButton,
              { opacity: currentExerciseIndex === 0 ? 0.3 : 1 },
            ]}
            testID="button-prev-exercise"
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.exerciseIndicator}>
            <ThemedText style={[styles.exerciseCounter, { color: theme.textSecondary }]}>
              Exercise {currentExerciseIndex + 1} of {day.exercises.length}
            </ThemedText>
          </View>

          <Pressable
            onPress={handleNextExercise}
            disabled={isLastExercise}
            style={[
              styles.navButton,
              { opacity: isLastExercise ? 0.3 : 1 },
            ]}
            testID="button-next-exercise"
          >
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <Animated.View
          key={currentExerciseIndex}
          entering={SlideInRight.duration(300)}
          style={styles.exerciseContent}
        >
          <View style={styles.exerciseHeader}>
            <ThemedText style={styles.exerciseName}>{currentExercise.name}</ThemedText>
            <View style={styles.exerciseMeta}>
              <View style={[styles.metaBadge, { backgroundColor: Colors.light.primary + "15" }]}>
                <ThemedText style={[styles.metaText, { color: Colors.light.primary }]}>
                  {currentExercise.muscleGroup}
                </ThemedText>
              </View>
              <ThemedText style={[styles.targetText, { color: theme.textSecondary }]}>
                {currentExercise.sets} sets x {currentExercise.reps}
              </ThemedText>
            </View>
          </View>

          <View style={styles.setsContainer}>
            {exerciseProgress.sets.map((setData, index) => (
              <SetInput
                key={index}
                setIndex={index}
                setData={setData}
                lastWeekData={lastWeekExercise?.sets[index] || null}
                onUpdate={handleUpdateSet}
                onComplete={handleSetComplete}
                isActive={index === currentSetIndex}
              />
            ))}
          </View>
        </Animated.View>

        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          {exerciseComplete && !isLastExercise ? (
            <AnimatedPressable
              onPress={handleNextExercise}
              onPressIn={() => {
                buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
              }}
              style={animatedButtonStyle}
              testID="button-next"
            >
              <LinearGradient
                colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                <ThemedText style={styles.nextButtonText}>Next Exercise</ThemedText>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </LinearGradient>
            </AnimatedPressable>
          ) : isLastExercise && exerciseComplete ? (
            <AnimatedPressable
              onPress={handleFinishWorkout}
              onPressIn={() => {
                buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1, { damping: 15, stiffness: 150 });
              }}
              style={animatedButtonStyle}
              testID="button-finish"
            >
              <LinearGradient
                colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.finishButton}
              >
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText style={styles.finishButtonText}>Finish Workout</ThemedText>
              </LinearGradient>
            </AnimatedPressable>
          ) : (
            <Pressable
              onPress={handleFinishWorkout}
              style={[styles.skipButton, { borderColor: theme.border }]}
              testID="button-skip-finish"
            >
              <ThemedText style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                Finish Early
              </ThemedText>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  planLabel: {
    fontSize: 13,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressGradient: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  exerciseNavigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseIndicator: {
    flex: 1,
    alignItems: "center",
  },
  exerciseCounter: {
    fontSize: 13,
    fontWeight: "500",
  },
  exerciseContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  exerciseHeader: {
    marginBottom: Spacing.xl,
  },
  exerciseName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
  },
  exerciseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  metaBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  targetText: {
    fontSize: 14,
  },
  setsContainer: {
    gap: Spacing.md,
  },
  setRowInactive: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    opacity: 0.6,
  },
  setRowCompleted: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  setNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: "600",
  },
  upcomingText: {
    fontSize: 14,
  },
  completedSetText: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  completedRating: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  activeSetContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  activeSetHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  setNumberLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  setNumberLargeText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
  },
  activeSetInfo: {
    flex: 1,
  },
  activeSetTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  lastWeekBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastWeekLabel: {
    fontSize: 13,
  },
  lastWeekRatingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inputsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    height: 56,
    paddingHorizontal: Spacing.lg,
  },
  inputText: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  inputUnit: {
    fontSize: 16,
    marginLeft: Spacing.xs,
  },
  ratingSection: {
    alignItems: "center",
  },
  ratingQuestion: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: Spacing.md,
  },
  ratingButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  ratingButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
    minWidth: 80,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ratingHint: {
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  finishButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  skipButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
