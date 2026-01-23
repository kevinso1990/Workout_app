import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
  FadeIn,
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
}: {
  rating: "green" | "yellow" | "red";
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const labels = {
    green: "Easy",
    yellow: "Good",
    red: "Hard",
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
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
          borderWidth: selected ? 0 : 1,
        },
      ]}
      testID={`button-rating-${rating}`}
    >
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

function SetRow({
  setIndex,
  setData,
  lastWeekData,
  onUpdate,
}: {
  setIndex: number;
  setData: SetData;
  lastWeekData: { weight: string; reps: string; rating: SetRating } | null;
  onUpdate: (data: Partial<SetData>) => void;
}) {
  const { theme } = useTheme();

  const handleRating = (rating: SetRating) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdate({ rating, completed: true });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(setIndex * 50).duration(300)}
      style={[styles.setRow, { backgroundColor: theme.backgroundSecondary }]}
    >
      <View style={styles.setHeader}>
        <View
          style={[
            styles.setNumber,
            {
              backgroundColor: setData.completed
                ? Colors.light.primary
                : theme.border,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.setNumberText,
              { color: setData.completed ? "#FFFFFF" : theme.text },
            ]}
          >
            {setIndex + 1}
          </ThemedText>
        </View>
        {lastWeekData ? (
          <View style={styles.lastWeekInfo}>
            <Feather name="clock" size={12} color={theme.textSecondary} />
            <ThemedText
              style={[styles.lastWeekText, { color: theme.textSecondary }]}
            >
              Last: {lastWeekData.weight}kg x {lastWeekData.reps}
            </ThemedText>
            {lastWeekData.rating ? (
              <View
                style={[
                  styles.lastWeekRating,
                  { backgroundColor: RATING_COLORS[lastWeekData.rating] },
                ]}
              />
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Weight
          </ThemedText>
          <View
            style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault }]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={setData.weight}
              onChangeText={(text) => onUpdate({ weight: text })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              testID={`input-weight-${setIndex}`}
            />
            <ThemedText style={[styles.inputUnit, { color: theme.textSecondary }]}>
              kg
            </ThemedText>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Reps
          </ThemedText>
          <View
            style={[styles.inputContainer, { backgroundColor: theme.backgroundDefault }]}
          >
            <TextInput
              style={[styles.input, { color: theme.text }]}
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

      <View style={styles.ratingRow}>
        <ThemedText style={[styles.ratingLabel, { color: theme.textSecondary }]}>
          How did it feel?
        </ThemedText>
        <View style={styles.ratingButtons}>
          <RatingButton
            rating="red"
            selected={setData.rating === "red"}
            onPress={() => handleRating("red")}
          />
          <RatingButton
            rating="yellow"
            selected={setData.rating === "yellow"}
            onPress={() => handleRating("yellow")}
          />
          <RatingButton
            rating="green"
            selected={setData.rating === "green"}
            onPress={() => handleRating("green")}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function ExerciseCard({
  exercise,
  exerciseIndex,
  progress,
  lastWeekProgress,
  onUpdateSet,
  isExpanded,
  onToggle,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  progress: ExerciseProgress;
  lastWeekProgress: ExerciseProgress | null;
  onUpdateSet: (setIndex: number, data: Partial<SetData>) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const completedSets = progress.sets.filter((s) => s.completed).length;

  return (
    <Animated.View
      entering={FadeInDown.delay(exerciseIndex * 100).duration(400)}
      style={[styles.exerciseCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <Pressable onPress={onToggle} style={styles.exerciseHeader} testID={`button-exercise-${exerciseIndex}`}>
        <View style={styles.exerciseInfo}>
          <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
          <ThemedText style={[styles.muscleGroup, { color: theme.textSecondary }]}>
            {exercise.muscleGroup} • {exercise.sets} sets x {exercise.reps}
          </ThemedText>
        </View>
        <View style={styles.exerciseRight}>
          <View
            style={[
              styles.progressBadge,
              {
                backgroundColor:
                  completedSets === exercise.sets
                    ? Colors.light.primary + "20"
                    : theme.backgroundSecondary,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.progressText,
                {
                  color:
                    completedSets === exercise.sets
                      ? Colors.light.primary
                      : theme.textSecondary,
                },
              ]}
            >
              {completedSets}/{exercise.sets}
            </ThemedText>
          </View>
          <Feather
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>

      {isExpanded ? (
        <View style={styles.setsContainer}>
          {progress.sets.map((setData, setIndex) => (
            <SetRow
              key={setIndex}
              setIndex={setIndex}
              setData={setData}
              lastWeekData={lastWeekProgress?.sets[setIndex] || null}
              onUpdate={(data) => onUpdateSet(setIndex, data)}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ActiveWorkoutRouteProp>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
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
        (s) =>
          s.planId === targetPlan.id && s.dayName === day.dayName
      );
      if (lastSession?.exerciseProgress) {
        setLastWeekProgress(lastSession.exerciseProgress);
      }
    } catch (error) {
      console.error("Error loading:", error);
    }
  };

  const handleUpdateSet = (
    exerciseIndex: number,
    setIndex: number,
    data: Partial<SetData>
  ) => {
    setProgress((prev) => {
      const updated = [...prev];
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) =>
          i === setIndex ? { ...s, ...data } : s
        ),
      };
      return updated;
    });
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

  if (!plan) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  const day = plan.days[route.params.dayIndex];
  const totalSets = progress.reduce((acc, ex) => acc + ex.sets.length, 0);
  const completedSets = progress.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const progressPercent = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
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
            <View
              style={[styles.progressBarBg, { backgroundColor: theme.border }]}
            >
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                ]}
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
              {completedSets}/{totalSets} sets
            </ThemedText>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {day.exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              exerciseIndex={index}
              progress={progress[index] || { exerciseId: exercise.id, sets: [] }}
              lastWeekProgress={lastWeekProgress[index] || null}
              onUpdateSet={(setIndex, data) =>
                handleUpdateSet(index, setIndex, data)
              }
              isExpanded={expandedIndex === index}
              onToggle={() =>
                setExpandedIndex(expandedIndex === index ? -1 : index)
              }
            />
          ))}
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
          <AnimatedPressable
            onPress={handleFinishWorkout}
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
            testID="button-finish"
          >
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.finishButton}
            >
              <Feather name="check" size={20} color="#FFFFFF" />
              <ThemedText style={styles.finishButtonText}>
                Finish Workout
              </ThemedText>
            </LinearGradient>
          </AnimatedPressable>
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
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing.lg,
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
    fontSize: 20,
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
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  exerciseCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  muscleGroup: {
    fontSize: 13,
  },
  exerciseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
  },
  setsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  setRow: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  setNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: "600",
  },
  lastWeekInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lastWeekText: {
    fontSize: 12,
  },
  lastWeekRating: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  inputUnit: {
    fontSize: 13,
    marginLeft: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingLabel: {
    fontSize: 12,
  },
  ratingButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  ratingButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.lg,
  },
  finishButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  finishButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
