import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  Image,
  Share,
  AppState,
  AppStateStatus,
} from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import Slider from "@react-native-community/slider";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInRight,
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
  calculateProgressionWeight,
  getUserPreferences,
  FitnessLevel,
  FitnessGoal,
} from "@/lib/storage";
import {
  getExerciseImageUrl,
  getMuscleGroupMeta,
} from "@/lib/exerciseImages";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ActiveWorkoutRouteProp = RouteProp<RootStackParamList, "ActiveWorkout">;

type SetRating = "green" | "yellow" | "red" | null;
type DifficultyRating = "easy" | "good" | "hard";




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

interface PRRecord {
  exerciseName: string;
  weight: number;
  reps: number;
}

const RATING_COLORS = {
  green: "#22C55E",
  yellow: "#F59E0B",
  red: "#EF4444",
};

const DEFAULT_REST_TIME = 90;
const BAR_WEIGHT = 20;
const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function calculatePlates(totalWeight: number): { plates: number[]; perSide: string } {
  const weightPerSide = (totalWeight - BAR_WEIGHT) / 2;
  if (weightPerSide <= 0) {
    return { plates: [], perSide: "Just the bar" };
  }

  const platesNeeded: number[] = [];
  let remaining = weightPerSide;

  for (const plate of AVAILABLE_PLATES) {
    while (remaining >= plate) {
      platesNeeded.push(plate);
      remaining -= plate;
    }
  }

  if (platesNeeded.length === 0) {
    return { plates: [], perSide: "Just the bar" };
  }

  const plateStr = platesNeeded.join(" + ");
  return { plates: platesNeeded, perSide: `${plateStr} kg per side` };
}

function PlateCalculatorModal({
  visible,
  weight,
  onClose,
}: {
  visible: boolean;
  weight: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const calculation = calculatePlates(weight);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.plateModalOverlay} onPress={onClose}>
        <Animated.View
          entering={ZoomIn.duration(200)}
          style={[styles.plateModalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.plateHeader}>
            <Feather name="disc" size={24} color={Colors.light.primary} />
            <ThemedText style={styles.plateTitle}>Plate Calculator</ThemedText>
          </View>

          <View style={styles.plateBarSection}>
            <ThemedText style={[styles.plateLabel, { color: theme.textSecondary }]}>
              Bar weight
            </ThemedText>
            <ThemedText style={styles.plateValue}>{BAR_WEIGHT}kg</ThemedText>
          </View>

          <View style={styles.plateDivider}>
            <View style={[styles.plateDividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.plateResultSection}>
            <ThemedText style={[styles.plateLabel, { color: theme.textSecondary }]}>
              Total: {weight}kg
            </ThemedText>
            <View style={styles.plateResult}>
              {calculation.plates.length > 0 ? (
                <View style={styles.plateVisual}>
                  {calculation.plates.map((plate, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.plateChip,
                        {
                          backgroundColor: Colors.light.primary,
                          width: 30 + plate * 1.2,
                        },
                      ]}
                    >
                      <ThemedText style={styles.plateChipText}>{plate}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
              <ThemedText style={[styles.plateDescription, { color: theme.text }]}>
                {calculation.perSide}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.plateCloseButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <ThemedText style={{ color: theme.text }}>Got it</ThemedText>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function RestTimerModal({
  visible,
  timeLeft,
  onSkip,
}: {
  visible: boolean;
  timeLeft: number;
  onSkip: () => void;
}) {
  const { theme } = useTheme();
  const progress = timeLeft / DEFAULT_REST_TIME;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.restModalOverlay}>
        <Animated.View
          entering={ZoomIn.duration(300)}
          style={[styles.restModalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <ThemedText style={styles.restTitle}>Rest Time</ThemedText>
          <View style={styles.timerCircle}>
            <View
              style={[
                styles.timerCircleProgress,
                {
                  backgroundColor: Colors.light.primary,
                  transform: [{ scaleX: progress }],
                },
              ]}
            />
            <ThemedText style={styles.timerText}>{formatTime(timeLeft)}</ThemedText>
          </View>
          <ThemedText style={[styles.restHint, { color: theme.textSecondary }]}>
            Take a breather, you earned it
          </ThemedText>
          <Pressable onPress={onSkip} style={styles.skipRestButton}>
            <ThemedText style={[styles.skipRestText, { color: Colors.light.primary }]}>
              Skip Rest
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PRCelebration({
  visible,
  pr,
  onClose,
}: {
  visible: boolean;
  pr: PRRecord | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();

  if (!visible || !pr) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.prModalOverlay}>
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={[styles.prModalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            style={styles.prBadge}
          >
            <Feather name="award" size={40} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText style={styles.prTitle}>New Personal Record!</ThemedText>
          <ThemedText style={styles.prExercise}>{pr.exerciseName}</ThemedText>
          <View style={styles.prStats}>
            <View style={styles.prStatItem}>
              <ThemedText style={styles.prStatValue}>{pr.weight}</ThemedText>
              <ThemedText style={[styles.prStatLabel, { color: theme.textSecondary }]}>
                kg
              </ThemedText>
            </View>
            <View style={[styles.prDivider, { backgroundColor: theme.border }]} />
            <View style={styles.prStatItem}>
              <ThemedText style={styles.prStatValue}>{pr.reps}</ThemedText>
              <ThemedText style={[styles.prStatLabel, { color: theme.textSecondary }]}>
                reps
              </ThemedText>
            </View>
          </View>
          <Pressable onPress={onClose}>
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              style={styles.prButton}
            >
              <ThemedText style={styles.prButtonText}>Awesome!</ThemedText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function WorkoutSummary({
  visible,
  duration,
  totalSets,
  completedSets,
  totalVolume,
  prs,
  workoutName,
  onClose,
}: {
  visible: boolean;
  duration: number;
  totalSets: number;
  completedSets: number;
  totalVolume: number;
  prs: PRRecord[];
  workoutName: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    const prLine =
      prs.length > 0
        ? `\n🏆 PRs: ${prs.map((pr) => `${pr.exerciseName} (${pr.weight}kg × ${pr.reps})`).join(", ")}`
        : "";

    const text =
      `💪 Workout Complete — ${workoutName}\n` +
      `📅 ${today}\n` +
      `⏱ ${formatTime(duration)} · ${completedSets} sets · ${totalVolume.toLocaleString()} kg volume` +
      prLine +
      `\n\nTracked with TrackYourLift`;

    Share.share({ message: text });
  };

  // Render nothing when invisible — safe because this is a JS overlay,
  // not a native Modal. No UIKit presentation context to clean up.
  if (!visible) return null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Use an absolute-fill overlay instead of a native <Modal>.
  // A native Modal that is force-unmounted (vs. properly dismissed) leaves
  // iOS's UIKit presentation context in a transitioning state, which causes
  // a blank/black frame when navigation.reset() fires in the same render.
  // A plain View overlay has no native presentation layer — navigation.reset()
  // can fire immediately and safely destroy the entire screen.
  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[StyleSheet.absoluteFillObject, styles.summaryOverlay]}
    >
      <ThemedView
        style={[styles.summaryContainer, { paddingTop: insets.top + Spacing.xl }]}
      >
        <View
          style={[styles.shareableCard, { backgroundColor: theme.backgroundRoot }]}
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            style={styles.shareCardHeader}
          >
            <Image source={require('../../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} />
            <ThemedText style={styles.shareCardDate}>{today}</ThemedText>
          </LinearGradient>

          <View
            style={[
              styles.shareCardContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.shareCardBadge}>
              <Feather
                name="check-circle"
                size={32}
                color={Colors.light.primary}
              />
            </View>

            <ThemedText style={styles.shareCardTitle}>{workoutName}</ThemedText>
            <ThemedText
              style={[styles.shareCardSubtitle, { color: theme.textSecondary }]}
            >
              Workout Complete
            </ThemedText>

            <View style={styles.shareCardStats}>
              <View style={styles.shareCardStat}>
                <ThemedText style={styles.shareCardStatValue}>
                  {formatTime(duration)}
                </ThemedText>
                <ThemedText
                  style={[styles.shareCardStatLabel, { color: theme.textSecondary }]}
                >
                  Duration
                </ThemedText>
              </View>
              <View
                style={[
                  styles.shareCardStatDivider,
                  { backgroundColor: theme.border },
                ]}
              />
              <View style={styles.shareCardStat}>
                <ThemedText style={styles.shareCardStatValue}>
                  {completedSets}
                </ThemedText>
                <ThemedText
                  style={[styles.shareCardStatLabel, { color: theme.textSecondary }]}
                >
                  Sets
                </ThemedText>
              </View>
              <View
                style={[
                  styles.shareCardStatDivider,
                  { backgroundColor: theme.border },
                ]}
              />
              <View style={styles.shareCardStat}>
                <ThemedText style={styles.shareCardStatValue}>
                  {totalVolume.toLocaleString()}
                </ThemedText>
                <ThemedText
                  style={[styles.shareCardStatLabel, { color: theme.textSecondary }]}
                >
                  kg Volume
                </ThemedText>
              </View>
            </View>

            {prs.length > 0 ? (
              <View style={styles.shareCardPRList}>
                {prs.map((pr) => (
                  <View key={pr.exerciseName} style={styles.shareCardPR}>
                    <Feather name="award" size={14} color="#B8860B" />
                    <ThemedText style={styles.shareCardPRText}>
                      {pr.exerciseName} — {pr.weight}kg × {pr.reps}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.shareActions}
        >
          <Pressable
            onPress={handleShare}
            style={styles.shareButton}
          >
            <Feather name="share-2" size={20} color={Colors.light.primary} />
            <ThemedText
              style={[
                styles.shareButtonText,
                { color: Colors.light.primary },
              ]}
            >
              Share Workout
            </ThemedText>
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={[
            styles.summaryBottom,
            { paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <Pressable onPress={onClose}>
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              style={styles.summaryButton}
            >
              <ThemedText style={styles.summaryButtonText}>Done</ThemedText>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ThemedView>
    </Animated.View>
  );
}

function QuickAdjustButton({
  label,
  onPress,
  type,
}: {
  label: string;
  onPress: () => void;
  type: "increase" | "decrease";
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.quickAdjustButton,
        {
          backgroundColor:
            type === "increase"
              ? Colors.light.primary + "15"
              : theme.backgroundSecondary,
          borderColor:
            type === "increase" ? Colors.light.primary : theme.border,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.quickAdjustText,
          {
            color:
              type === "increase"
                ? Colors.light.primary
                : theme.textSecondary,
          },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
  Chest: [
    "Barbell Bench Press",
    "Incline Dumbbell Press",
    "Cable Flyes",
    "Push-ups",
    "Dumbbell Flyes",
    "Machine Chest Press",
    "Dips",
  ],
  Back: [
    "Barbell Deadlift",
    "Barbell Bent-Over Row",
    "Wide-Grip Lat Pulldown",
    "Pull-ups",
    "Seated Cable Row",
    "Dumbbell Rows",
    "T-Bar Row",
  ],
  Shoulders: [
    "Barbell Overhead Press",
    "Dumbbell Shoulder Press",
    "Dumbbell Lateral Raises",
    "Cable Face Pulls",
    "Arnold Press",
    "Dumbbell Front Raises",
  ],
  "Rear Delts": [
    "Cable Face Pulls",
    "Bent-Over Rear Delt Flyes",
    "Reverse Pec Deck",
    "Band Pull-Aparts",
    "Seated Rear Delt Raises",
  ],
  Legs: [
    "Barbell Back Squat",
    "Machine Leg Press",
    "Dumbbell Lunges",
    "Machine Leg Extension",
    "Lying Leg Curl",
    "Romanian Deadlift",
    "Bulgarian Split Squat",
  ],
  Quads: [
    "Barbell Back Squat",
    "Machine Leg Press",
    "Dumbbell Lunges",
    "Machine Leg Extension",
    "Hack Squat",
    "Bulgarian Split Squat",
    "Front Squat",
  ],
  Hamstrings: [
    "Romanian Deadlift",
    "Lying Leg Curl",
    "Stiff-Leg Deadlift",
    "Good Mornings",
    "Nordic Curl",
    "Glute Ham Raise",
  ],
  Calves: [
    "Standing Calf Raises",
    "Seated Calf Raises",
    "Leg Press Calf Raises",
    "Donkey Calf Raises",
    "Single-Leg Calf Raises",
  ],
  Glutes: [
    "Barbell Hip Thrust",
    "Romanian Deadlift",
    "Bulgarian Split Squat",
    "Glute Bridge",
    "Cable Kickback",
    "Sumo Deadlift",
  ],
  Arms: [
    "Barbell Bicep Curl",
    "Cable Tricep Pushdown",
    "Hammer Curls",
    "Skull Crushers",
    "Preacher Curls",
    "Cable Curls",
  ],
  Biceps: [
    "Barbell Bicep Curl",
    "Dumbbell Bicep Curl",
    "Hammer Curls",
    "Preacher Curl",
    "Cable Curl",
    "Concentration Curl",
    "Incline Dumbbell Curl",
  ],
  Triceps: [
    "Cable Tricep Pushdown",
    "Skull Crushers",
    "Overhead Tricep Extension",
    "Dips",
    "Close-Grip Bench Press",
    "Cable Overhead Extension",
    "Diamond Push-ups",
  ],
  Core: [
    "Plank",
    "Crunches",
    "Leg Raises",
    "Russian Twists",
    "Cable Crunches",
    "Hanging Leg Raises",
  ],
  Traps: [
    "Barbell Shrugs",
    "Dumbbell Shrug",
    "Upright Row",
    "Cable Shrug",
    "Farmer's Walk",
  ],
  Forearms: [
    "Wrist Curl",
    "Reverse Wrist Curl",
    "Hammer Curls",
    "Reverse Curl",
    "Plate Pinch",
  ],
  "Full Body": [
    "Kettlebell Swings",
    "Burpees",
    "Thrusters",
    "Clean and Press",
    "Box Jumps",
    "Battle Ropes",
  ],
};

// Fallback map: handles lowercase, snake_case, alternate names, and server db values
const MUSCLE_GROUP_FALLBACK: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  shoulder: "Shoulders",
  delts: "Shoulders",
  "rear delts": "Rear Delts",
  "rear delt": "Rear Delts",
  legs: "Legs",
  leg: "Legs",
  quads: "Quads",
  quad: "Quads",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  hamstring: "Hamstrings",
  calves: "Calves",
  calf: "Calves",
  glutes: "Glutes",
  glute: "Glutes",
  arms: "Arms",
  arm: "Arms",
  biceps: "Biceps",
  bicep: "Biceps",
  triceps: "Triceps",
  tricep: "Triceps",
  core: "Core",
  abs: "Core",
  ab: "Core",
  traps: "Traps",
  trap: "Traps",
  trapezius: "Traps",
  forearms: "Forearms",
  forearm: "Forearms",
  "full body": "Full Body",
  fullbody: "Full Body",
  cardio: "Core",
};

function getAlternativesForMuscleGroup(muscleGroup: string | undefined): string[] {
  if (!muscleGroup) {
    // No muscle group at all — return everything across all categories
    return Object.values(EXERCISE_ALTERNATIVES).flat();
  }

  // Direct match first (handles correct Title Case from DEFAULT_EXERCISES)
  if (EXERCISE_ALTERNATIVES[muscleGroup]) {
    return EXERCISE_ALTERNATIVES[muscleGroup];
  }

  // Case-insensitive match against known keys
  const lower = muscleGroup.trim().toLowerCase();
  const directKey = Object.keys(EXERCISE_ALTERNATIVES).find(
    (k) => k.toLowerCase() === lower
  );
  if (directKey) return EXERCISE_ALTERNATIVES[directKey];

  // Fallback map for alternate names, old data, snake_case, etc.
  const fallbackKey = MUSCLE_GROUP_FALLBACK[lower];
  if (fallbackKey && EXERCISE_ALTERNATIVES[fallbackKey]) {
    return EXERCISE_ALTERNATIVES[fallbackKey];
  }

  // Last resort: return all exercises so the user is never stuck with nothing
  return Object.values(EXERCISE_ALTERNATIVES).flat();
}

function ExerciseSwapModal({
  visible,
  currentExercise,
  onClose,
  onSwap,
}: {
  visible: boolean;
  currentExercise: { name: string; muscleGroup: string } | null;
  onClose: () => void;
  onSwap: (newExerciseName: string) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible || !currentExercise) return null;

  const alternatives = getAlternativesForMuscleGroup(currentExercise.muscleGroup);
  const filteredAlternatives = alternatives.filter(
    (ex) => ex !== currentExercise.name
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.swapModalOverlay} pointerEvents="box-none">
        <View
          style={[
            styles.swapModalContent,
            {
              backgroundColor: theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={styles.swapModalHeader}>
            <View>
              <ThemedText style={styles.swapModalTitle}>Swap Exercise</ThemedText>
              <ThemedText
                style={[
                  styles.swapModalSubtitle,
                  { color: theme.textSecondary },
                ]}
              >
                Equipment busy? Pick an alternative
              </ThemedText>
            </View>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ThemedText
            style={[styles.swapCurrentLabel, { color: theme.textSecondary }]}
          >
            Current: {currentExercise.name}
          </ThemedText>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.swapList}
            keyboardShouldPersistTaps="handled"
          >
            {filteredAlternatives.length === 0 ? (
              <View style={styles.swapEmptyState}>
                <Feather name="info" size={24} color={theme.textSecondary} />
                <ThemedText
                  style={[styles.swapEmptyText, { color: theme.textSecondary }]}
                >
                  No alternatives available for this exercise
                </ThemedText>
              </View>
            ) : null}
            {filteredAlternatives.map((exercise) => (
              <Pressable
                key={exercise}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSwap(exercise);
                  onClose();
                }}
                style={[
                  styles.swapOption,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                {getExerciseImageUrl(exercise) ? (
                  <Image
                    source={{ uri: getExerciseImageUrl(exercise)! }}
                    style={styles.swapOptionImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.swapOptionImagePlaceholder,
                      { backgroundColor: Colors.light.primary + "15" },
                    ]}
                  >
                    <Feather
                      name="activity"
                      size={20}
                      color={Colors.light.primary}
                    />
                  </View>
                )}
                <ThemedText style={styles.swapOptionText}>{exercise}</ThemedText>
                <Feather
                  name="chevron-right"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SetInput({
  setIndex,
  setData,
  lastWeekData,
  onUpdate,
  onComplete,
  isActive,
  exerciseName,
  targetReps,
}: {
  setIndex: number;
  setData: SetData;
  lastWeekData: { weight: string; reps: string; rating: SetRating } | null;
  onUpdate: (data: Partial<SetData>) => void;
  onComplete: () => void;
  isActive: boolean;
  exerciseName: string;
  targetReps?: string;
}) {
  const { theme } = useTheme();
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [showDifficulty, setShowDifficulty] = useState(false);

  const progressionSuggestion = useMemo(() => {
    if (!lastWeekData || !lastWeekData.weight || !lastWeekData.rating) return null;
    const lastWeight = parseFloat(lastWeekData.weight) || 0;
    return calculateProgressionWeight(lastWeight, lastWeekData.rating, exerciseName);
  }, [lastWeekData, exerciseName]);

  useEffect(() => {
    if (isActive && lastWeekData && setData.weight === "" && setData.reps === "") {
      if (progressionSuggestion) {
        onUpdate({
          weight: progressionSuggestion.suggestedWeight.toString(),
          reps: lastWeekData.reps,
        });
      } else {
        onUpdate({ weight: lastWeekData.weight, reps: lastWeekData.reps });
      }
    }
  }, [isActive]);

  // Reset difficulty panel if user changes weight/reps after opening it
  useEffect(() => {
    if (showDifficulty) setShowDifficulty(false);
  }, [setData.weight, setData.reps]);

  const handleDifficulty = (difficulty: DifficultyRating) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const rating: SetRating =
      difficulty === "easy" ? "green" : difficulty === "hard" ? "red" : "yellow";
    onUpdate({ rating, completed: true });
    onComplete();
  };

  const canLog = setData.weight.trim() !== "" && setData.reps.trim() !== "";

  if (!isActive && !setData.completed) {
    return (
      <View
        style={[
          styles.setRowInactive,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <View style={[styles.setNumber, { backgroundColor: theme.border }]}>
          <ThemedText
            style={[styles.setNumberText, { color: theme.textSecondary }]}
          >
            {setIndex + 1}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.upcomingText, { color: theme.textSecondary }]}
        >
          Set {setIndex + 1}
          {targetReps ? (
            <ThemedText style={[styles.upcomingText, { color: theme.textSecondary }]}>
              {" "}· target {targetReps} reps
            </ThemedText>
          ) : null}
        </ThemedText>
      </View>
    );
  }

  if (setData.completed) {
    const completedWeight = parseFloat(setData.weight) || 0;
    const targetWeight =
      progressionSuggestion?.suggestedWeight ||
      (lastWeekData ? parseFloat(lastWeekData.weight) : 0);
    const performanceStatus =
      completedWeight > targetWeight
        ? "exceeded"
        : completedWeight === targetWeight
        ? "hit"
        : completedWeight > 0 && targetWeight > 0
        ? "below"
        : null;

    return (
      <View
        style={[
          styles.setRowCompleted,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <View
          style={[styles.setNumber, { backgroundColor: Colors.light.primary }]}
        >
          <Feather name="check" size={14} color="#FFFFFF" />
        </View>
        <View style={styles.completedSetInfo}>
          <ThemedText style={styles.completedSetText}>
            {setData.weight}kg x {setData.reps} reps
          </ThemedText>
          {performanceStatus === "exceeded" ? (
            <View
              style={[
                styles.performanceBadge,
                { backgroundColor: "#4CAF50" + "20" },
              ]}
            >
              <Feather name="trending-up" size={10} color="#4CAF50" />
              <ThemedText
                style={[
                  styles.performanceBadgeText,
                  { color: "#4CAF50" },
                ]}
              >
                +{(completedWeight - targetWeight).toFixed(1)}kg
              </ThemedText>
            </View>
          ) : performanceStatus === "hit" && targetWeight > 0 ? (
            <View
              style={[
                styles.performanceBadge,
                { backgroundColor: Colors.light.primary + "20" },
              ]}
            >
              <Feather
                name="check"
                size={10}
                color={Colors.light.primary}
              />
              <ThemedText
                style={[
                  styles.performanceBadgeText,
                  { color: Colors.light.primary },
                ]}
              >
                Target hit
              </ThemedText>
            </View>
          ) : null}
        </View>
        
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
      style={[
        styles.activeSetContainer,
        { backgroundColor: theme.backgroundDefault },
      ]}
    >
      <View style={styles.activeSetHeader}>
        <View
          style={[
            styles.setNumberLarge,
            { backgroundColor: Colors.light.primary },
          ]}
        >
          <ThemedText style={styles.setNumberLargeText}>
            {setIndex + 1}
          </ThemedText>
        </View>
        <View style={styles.activeSetInfo}>
          <ThemedText style={styles.activeSetTitle}>
            Set {setIndex + 1}
          </ThemedText>
          {lastWeekData ? (
            <View style={styles.lastWeekBadge}>
              <ThemedText
                style={[
                  styles.lastWeekLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Last session: {lastWeekData.weight}kg x {lastWeekData.reps}
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

      {progressionSuggestion ? (
        <View
          style={[
            styles.targetCard,
            {
              backgroundColor: Colors.light.primary + "10",
              borderColor: Colors.light.primary + "30",
            },
          ]}
        >
          <View style={styles.targetHeader}>
            <View style={styles.targetIconContainer}>
              <Feather
                name="target"
                size={16}
                color={Colors.light.primary}
              />
            </View>
            <ThemedText
              style={[
                styles.targetTitle,
                { color: Colors.light.primary },
              ]}
            >
              Today&apos;s Target
            </ThemedText>
          </View>
          <View style={styles.targetContent}>
            <ThemedText style={styles.targetWeight}>
              {progressionSuggestion.suggestedWeight}kg
            </ThemedText>
            <ThemedText
              style={[styles.targetReps, { color: theme.textSecondary }]}
            >
              x {lastWeekData?.reps || "8-10"}
            </ThemedText>
          </View>
          <View style={styles.targetReason}>
            <Feather
              name={
                lastWeekData?.rating === "green"
                  ? "trending-up"
                  : lastWeekData?.rating === "red"
                  ? "trending-down"
                  : "minus"
              }
              size={12}
              color={theme.textSecondary}
            />
            <ThemedText
              style={[styles.targetReasonText, { color: theme.textSecondary }]}
            >
              {progressionSuggestion.message}
            </ThemedText>
          </View>
        </View>
      ) : !lastWeekData ? (
        <View
          style={[
            styles.targetCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.targetHeader}>
            <View
              style={[
                styles.targetIconContainer,
                { backgroundColor: theme.border },
              ]}
            >
              <Feather
                name="plus"
                size={16}
                color={theme.textSecondary}
              />
            </View>
            <ThemedText
              style={[styles.targetTitle, { color: theme.text }]}
            >
              First Time
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.firstTimeHint, { color: theme.textSecondary }]}
          >
            Start with a weight you can lift for 8-10 reps with good form
          </ThemedText>
        </View>
      ) : null}

      <PlateCalculatorModal
        visible={showPlateCalc}
        weight={parseFloat(setData.weight) || 0}
        onClose={() => setShowPlateCalc(false)}
      />

      <View style={styles.sliderSection}>
        <View style={styles.sliderWrapper}>
          <View style={styles.sliderLabelRow}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Weight
            </ThemedText>
            <View style={styles.sliderValueContainer}>
              <ThemedText style={[styles.sliderValue, { color: theme.text }]}>
                {parseFloat(setData.weight) || 0}
              </ThemedText>
              <ThemedText
                style={[styles.sliderUnit, { color: theme.textSecondary }]}
              >
                kg
              </ThemedText>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowPlateCalc(true);
                }}
                style={[
                  styles.plateButton,
                  { backgroundColor: Colors.light.primary + "15" },
                ]}
                testID={`button-plate-calc-${setIndex}`}
              >
                <Feather
                  name="disc"
                  size={12}
                  color={Colors.light.primary}
                />
              </Pressable>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={200}
            step={2.5}
            value={parseFloat(setData.weight) || 0}
            onValueChange={(value: number) => {
              onUpdate({ weight: value.toString() });
            }}
            onSlidingComplete={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            minimumTrackTintColor={Colors.light.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={Colors.light.primary}
            testID={`slider-weight-${setIndex}`}
          />
        </View>

        <View style={styles.sliderWrapper}>
          <View style={styles.sliderLabelRow}>
            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary }]}
            >
              Reps
            </ThemedText>
            <ThemedText style={[styles.sliderValue, { color: theme.text }]}>
              {parseInt(setData.reps) || 0}
            </ThemedText>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={30}
            step={1}
            value={parseInt(setData.reps) || 0}
            onValueChange={(value: number) => {
              onUpdate({ reps: value.toString() });
            }}
            onSlidingComplete={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            minimumTrackTintColor={Colors.light.primary}
            maximumTrackTintColor={theme.border}
            thumbTintColor={Colors.light.primary}
            testID={`slider-reps-${setIndex}`}
          />
        </View>
      </View>

      {!showDifficulty ? (
        <View style={styles.logSection}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowDifficulty(true);
            }}
            disabled={!canLog}
            testID={`button-log-set-${setIndex}`}
          >
            <LinearGradient
              colors={
                canLog
                  ? [Colors.light.primary, Colors.light.primaryGradientEnd]
                  : [theme.border, theme.border]
              }
              style={styles.logButton}
            >
              <ThemedText style={styles.logButtonText}>Log this set</ThemedText>
            </LinearGradient>
          </Pressable>
          {!canLog ? (
            <ThemedText style={[styles.logHint, { color: theme.textSecondary }]}>
              Enter weight and reps above first
            </ThemedText>
          ) : null}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.difficultySection}>
          <ThemedText style={[styles.difficultyPrompt, { color: theme.textSecondary }]}>
            How did it feel?
          </ThemedText>
          <View style={styles.difficultyRow}>
            <Pressable
              onPress={() => handleDifficulty("easy")}
              style={[styles.difficultyBtn, { borderColor: RATING_COLORS.green, backgroundColor: RATING_COLORS.green + "15" }]}
              testID={`button-difficulty-easy-${setIndex}`}
            >
              <ThemedText style={styles.difficultyEmoji}>😤</ThemedText>
              <ThemedText style={[styles.difficultyLabel, { color: RATING_COLORS.green }]}>Easy</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleDifficulty("good")}
              style={[styles.difficultyBtn, { borderColor: Colors.light.primary, backgroundColor: Colors.light.primary + "15" }]}
              testID={`button-difficulty-good-${setIndex}`}
            >
              <ThemedText style={styles.difficultyEmoji}>😐</ThemedText>
              <ThemedText style={[styles.difficultyLabel, { color: Colors.light.primary }]}>Good</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleDifficulty("hard")}
              style={[styles.difficultyBtn, { borderColor: RATING_COLORS.red, backgroundColor: RATING_COLORS.red + "15" }]}
              testID={`button-difficulty-hard-${setIndex}`}
            >
              <ThemedText style={styles.difficultyEmoji}>💀</ThemedText>
              <ThemedText style={[styles.difficultyLabel, { color: RATING_COLORS.red }]}>Hard</ThemedText>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setShowDifficulty(false)}
            style={styles.difficultyBack}
          >
            <ThemedText style={[styles.difficultyBackText, { color: theme.textSecondary }]}>
              ← Back
            </ThemedText>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ActiveWorkoutRouteProp>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [progress, setProgress] = useState<ExerciseProgress[]>([]);
  const [lastWeekProgress, setLastWeekProgress] = useState<ExerciseProgress[]>(
    []
  );
  const [allHistory, setAllHistory] = useState<WorkoutSession[]>([]);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(DEFAULT_REST_TIME);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [currentPR, setCurrentPR] = useState<PRRecord | null>(null);
  const [prsThisSession, setPrsThisSession] = useState<PRRecord[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const navFiredRef = useRef(false);
  const isSavingRef = useRef(false);
  const timerEndTimeRef = useRef<number | null>(null);
  const scheduledNotifIdRef = useRef<string | null>(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [fitnessGoals, setFitnessGoals] = useState<FitnessGoal[]>([]);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const buttonScale = useSharedValue(1);

  // Rest duration varies by goal: strength needs longer recovery than endurance/fat-loss
  const restDuration = useMemo(() => {
    if (fitnessGoals.includes("get_stronger")) return 180; // 3 min — heavy loads need CNS recovery
    if (fitnessGoals.includes("lose_fat"))     return 45;  // 45 s  — elevated HR is the goal
    return 90; // default: muscle / build_muscle
  }, [fitnessGoals]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Cancels the pending rest notification and clears end-time tracking.
  const cancelRestNotification = () => {
    if (scheduledNotifIdRef.current) {
      Notifications.cancelScheduledNotificationAsync(scheduledNotifIdRef.current);
      scheduledNotifIdRef.current = null;
    }
    timerEndTimeRef.current = null;
  };

  // Schedules a notification for `seconds` from now and records the end time.
  const scheduleRestNotification = async (seconds: number) => {
    cancelRestNotification();
    timerEndTimeRef.current = Date.now() + seconds * 1000;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Rest complete",
          body: "Next set ready",
          sound: true,
        },
        trigger: {
          type: SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
      scheduledNotifIdRef.current = id;
    } catch {
      // Notification permission may be denied — timer still works visually.
    }
  };

  // Request notification permissions and set up AppState sync for background timer.
  useEffect(() => {
    Notifications.requestPermissionsAsync();

    // Play sound even when notification arrives while app is foregrounded,
    // but suppress the visual alert banner (the in-app modal is the UI).
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // When the app returns to foreground, correct the countdown for time
    // elapsed while the screen was locked (JS timers freeze on iOS background).
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && timerEndTimeRef.current !== null) {
        const remaining = Math.ceil((timerEndTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          // Timer already fired while screen was off.
          scheduledNotifIdRef.current = null;
          timerEndTimeRef.current = null;
          setShowRestTimer(false);
          setRestTimeLeft(DEFAULT_REST_TIME);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          // Snap the countdown to the real remaining time.
          setRestTimeLeft(remaining);
        }
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const currentExerciseName =
    plan?.days[route.params.dayIndex]?.exercises[currentExerciseIndex]?.name ??
    "";
  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [currentExerciseIndex, currentExerciseName]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showRestTimer && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft((prev) => {
          if (prev <= 1) {
            // Cancel the scheduled notification — the timer finished while the
            // app was in the foreground, so the notification is redundant.
            cancelRestNotification();
            setShowRestTimer(false);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            return DEFAULT_REST_TIME;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showRestTimer, restTimeLeft]);

  const loadData = async () => {
    try {
      const [plans, history, prefs] = await Promise.all([
        getWorkoutPlans(),
        getWorkoutHistory(),
        getUserPreferences(),
      ]);
      if (prefs?.fitnessLevel) setFitnessLevel(prefs.fitnessLevel);
      if (prefs?.fitnessGoals?.length) setFitnessGoals(prefs.fitnessGoals);
      setRestTimerEnabled(prefs?.restTimerEnabled !== false); // default true

      const targetPlan = plans.find((p) => p.id === route.params.planId);
      if (!targetPlan) return;

      setPlan(targetPlan);
      setAllHistory(history);
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

  const checkForPR = (
    exerciseName: string,
    weight: number,
    reps: number
  ) => {
    const exerciseHistory = allHistory.flatMap((session) =>
      (session.exerciseProgress || []).flatMap((ep, idx) =>
        session.exercises[idx]?.name === exerciseName
          ? ep.sets
              .filter((s) => s.completed)
              .map((s) => ({
                weight: parseFloat(s.weight) || 0,
                reps: parseInt(s.reps) || 0,
              }))
          : []
      )
    );

    const currentVolume = weight * reps;
    const maxPreviousVolume = Math.max(
      0,
      ...exerciseHistory.map((h) => h.weight * h.reps)
    );

    if (currentVolume > maxPreviousVolume && currentVolume > 0) {
      setCurrentPR({ exerciseName, weight, reps });
      setShowPRCelebration(true);
      setPrsThisSession((prev) =>
        prev.some((pr) => pr.exerciseName === exerciseName)
          ? prev.map((pr) =>
              pr.exerciseName === exerciseName ? { exerciseName, weight, reps } : pr
            )
          : [...prev, { exerciseName, weight, reps }]
      );
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
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
    const completedSet = exerciseProgress.sets[currentSetIndex];

    const weight = parseFloat(completedSet.weight) || 0;
    const reps = parseInt(completedSet.reps) || 0;
    if (weight > 0 && reps > 0) {
      checkForPR(currentExercise.name, weight, reps);
    }

    if (currentSetIndex < currentExercise.sets - 1) {
      if (restTimerEnabled) {
        setShowRestTimer(true);
        setRestTimeLeft(restDuration);
        scheduleRestNotification(restDuration);
      }
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < day.exercises.length - 1) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const handleSkipRest = () => {
    cancelRestNotification();
    setShowRestTimer(false);
    setRestTimeLeft(restDuration);
  };

  const handleNextExercise = () => {
    if (!plan) return;
    const day = plan.days[route.params.dayIndex];

    if (currentExerciseIndex < day.exercises.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const nextIdx = currentExerciseIndex + 1;
      const nextEp = progress[nextIdx];
      const firstIncomplete = nextEp
        ? nextEp.sets.findIndex((s) => !s.completed)
        : 0;
      setCurrentExerciseIndex(nextIdx);
      setCurrentSetIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
  };

  const handlePreviousExercise = () => {
    if (currentExerciseIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevIdx = currentExerciseIndex - 1;
      const prevEp = progress[prevIdx];
      const firstIncomplete = prevEp
        ? prevEp.sets.findIndex((s) => !s.completed)
        : 0;
      setCurrentExerciseIndex(prevIdx);
      setCurrentSetIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
  };

  const handleFinishWorkout = async () => {
    if (!plan) return;

    const totalSets = progress.reduce(
      (acc, ex) => acc + ex.sets.length,
      0
    );
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
          { text: "Finish", onPress: () => saveAndShowSummary() },
        ]
      );
    } else {
      saveAndShowSummary();
    }
  };

  const saveAndShowSummary = async () => {
    if (!plan || isSavingRef.current) return;
    isSavingRef.current = true;

    // Cancel any pending rest notification so it doesn't fire after the
    // workout is complete.
    cancelRestNotification();

    // Close all native Modals before showing the summary overlay.
    // Any native Modal still mounted when navigation.reset() fires will
    // leave UIKit in a bad state and produce a black screen on iOS.
    setShowRestTimer(false);
    setShowPRCelebration(false);
    setShowExerciseDetail(false);

    const day = plan.days[route.params.dayIndex];
    const session: WorkoutSession = {
      id: Date.now().toString(),
      planId: plan.id,
      planName: plan.name,
      dayName: day.dayName,
      completedAt: new Date().toISOString(),
      exercises: day.exercises,
      exerciseProgress: progress,
      duration: elapsedTime,
    };

    try {
      await addWorkoutSession(session);
    } catch (error) {
      console.error("Failed to save workout:", error);
      Alert.alert(
        "Save Error",
        "Your workout couldn't be saved to storage. Your results are still shown below.",
        [{ text: "OK" }],
      );
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSummary(true);
  };

  const calculateTotalVolume = () => {
    return progress.reduce((total, ep) => {
      return (
        total +
        ep.sets
          .filter((s) => s.completed)
          .reduce((setTotal, s) => {
            const weight = parseFloat(s.weight) || 0;
            const reps = parseInt(s.reps) || 0;
            return setTotal + weight * reps;
          }, 0)
      );
    }, 0);
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
  const lastWeekExercise = lastWeekProgress.find(
    (ep) => ep.exerciseId === exerciseProgress.exerciseId,
  );

  const totalSets = progress.reduce(
    (acc, ex) => acc + ex.sets.length,
    0
  );
  const completedSets = progress.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const progressPercent =
    totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  const isLastExercise =
    currentExerciseIndex === day.exercises.length - 1;
  const exerciseComplete = exerciseProgress.sets.every(
    (s) => s.completed
  );

  return (
    <ThemedView style={styles.container}>
      <RestTimerModal
        visible={showRestTimer}
        timeLeft={restTimeLeft}
        onSkip={handleSkipRest}
      />
      <PRCelebration
        visible={showPRCelebration}
        pr={currentPR}
        onClose={() => setShowPRCelebration(false)}
      />
      {/* ExerciseSwapModal hidden for MVP — not release-ready on native */}
      <ExerciseDetailModal
        visible={showExerciseDetail}
        exerciseName={currentExercise.name}
        muscleGroup={currentExercise.muscleGroup}
        onClose={() => setShowExerciseDetail(false)}
      />
      <WorkoutSummary
        visible={showSummary}
        duration={elapsedTime}
        totalSets={totalSets}
        completedSets={completedSets}
        totalVolume={calculateTotalVolume()}
        prs={prsThisSession}
        workoutName={
          plan?.days[route.params.dayIndex]?.dayName || "Workout"
        }
        onClose={() => {
          if (navFiredRef.current) return;
          navFiredRef.current = true;
          navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        }}
      />

      <View style={styles.mainContainer}>
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
              <ThemedText style={styles.dayTitle}>
                {day.dayName}
              </ThemedText>
              <View style={styles.timerBadge}>
                <Feather
                  name="clock"
                  size={12}
                  color={Colors.light.primary}
                />
                <ThemedText
                  style={[
                    styles.timerBadgeText,
                    { color: Colors.light.primary },
                  ]}
                >
                  {formatTime(elapsedTime)}
                </ThemedText>
              </View>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarBg,
                { backgroundColor: theme.border },
              ]}
            >
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                ]}
              >
                <LinearGradient
                  colors={[
                    Colors.light.primary,
                    Colors.light.primaryGradientEnd,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>
            </View>
            <ThemedText
              style={[
                styles.progressLabel,
                { color: theme.textSecondary },
              ]}
            >
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
            <ThemedText
              style={[
                styles.exerciseCounter,
                { color: theme.textSecondary },
              ]}
            >
              Exercise {currentExerciseIndex + 1} of{" "}
              {day.exercises.length}
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

        <KeyboardAwareScrollViewCompat
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            key={currentExerciseIndex}
            entering={SlideInRight.duration(300)}
            style={styles.exerciseContent}
          >
            <View style={styles.exerciseHeader}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowExerciseDetail(true);
                }}
                style={styles.exerciseMediaTouchable}
              >
                {(() => {
                  const imageUrl = getExerciseImageUrl(currentExercise.name);
                  const meta = getMuscleGroupMeta(currentExercise.muscleGroup);
                  if (imageUrl && !imageError) {
                    return (
                      <View style={styles.exerciseImageWrapper}>
                        {imageLoading && (
                          <LinearGradient
                            colors={[meta.color + "18", meta.color + "30"]}
                            style={styles.exerciseImageSkeleton}
                          >
                            <Feather
                              name={meta.icon as any}
                              size={32}
                              color={meta.color + "80"}
                            />
                          </LinearGradient>
                        )}
                        <Image
                          source={{ uri: imageUrl }}
                          style={[
                            styles.exerciseImage,
                            imageLoading && { opacity: 0 },
                          ]}
                          resizeMode="cover"
                          onLoadStart={() => setImageLoading(true)}
                          onLoad={() => setImageLoading(false)}
                          onError={() => {
                            setImageError(true);
                            setImageLoading(false);
                          }}
                        />
                        <View style={styles.exerciseImageInfoHint}>
                          <Feather name="info" size={12} color="#FFFFFF" />
                        </View>
                      </View>
                    );
                  }
                  return (
                    <LinearGradient
                      colors={[meta.color + "18", meta.color + "35"]}
                      style={styles.exerciseImagePlaceholder}
                    >
                      <Feather name={meta.icon as any} size={36} color={meta.color} />
                      <ThemedText style={[styles.exerciseFallbackLabel, { color: meta.color }]}>
                        {meta.label}
                      </ThemedText>
                      <View style={styles.exerciseFallbackHint}>
                        <Feather name="info" size={11} color={meta.color + "80"} />
                        <ThemedText style={[styles.exerciseFallbackHintText, { color: meta.color + "80" }]}>
                          Tap for cues
                        </ThemedText>
                      </View>
                    </LinearGradient>
                  );
                })()}
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowExerciseDetail(true);
                }}
                style={styles.exerciseNameRow}
              >
                <ThemedText
                  style={styles.exerciseName}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {currentExercise.name}
                </ThemedText>
                <Feather name="info" size={14} color={Colors.light.primary + "80"} />
              </Pressable>
              <View style={styles.exerciseMeta}>
                <View
                  style={[
                    styles.metaBadge,
                    { backgroundColor: Colors.light.primary + "15" },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.metaText,
                      { color: Colors.light.primary },
                    ]}
                  >
                    {currentExercise.muscleGroup}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.targetText,
                    { color: theme.textSecondary },
                  ]}
                >
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
                  exerciseName={currentExercise.name}
                  targetReps={currentExercise.reps}
                />
              ))}
            </View>
          </Animated.View>
        </KeyboardAwareScrollViewCompat>

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
                colors={[
                  Colors.light.primary,
                  Colors.light.primaryGradientEnd,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextButton}
              >
                <ThemedText style={styles.nextButtonText}>
                  Next Exercise
                </ThemedText>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </LinearGradient>
            </AnimatedPressable>
          ) : isLastExercise && exerciseComplete ? (
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
                colors={[
                  Colors.light.primary,
                  Colors.light.primaryGradientEnd,
                ]}
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
          ) : (
            <Pressable
              onPress={handleFinishWorkout}
              style={[styles.skipButton, { borderColor: theme.border }]}
              testID="button-skip-finish"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Finish Early"
            >
              <ThemedText
                style={[
                  styles.skipButtonText,
                  { color: theme.text },
                ]}
              >
                Finish Early
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: Spacing["2xl"],
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
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: "600",
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
    flexShrink: 1,
    flexWrap: "wrap",
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
  progressionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  progressionText: {
    fontSize: 11,
    fontWeight: "600",
  },
  inputsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  plateButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderSection: {
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sliderWrapper: {
    gap: Spacing.sm,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  sliderUnit: {
    fontSize: 14,
    fontWeight: "500",
  },
  slider: {
    width: "100%",
    height: 40,
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
    minHeight: 52,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  restModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  restModalContent: {
    width: SCREEN_WIDTH - 64,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  restTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xl,
  },
  timerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.light.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  timerCircleProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    opacity: 0.2,
  },
  timerText: {
    fontSize: 48,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  restHint: {
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  skipRestButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  skipRestText: {
    fontSize: 16,
    fontWeight: "600",
  },
  prModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  prModalContent: {
    width: SCREEN_WIDTH - 64,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  prBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  prTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
  },
  prExercise: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: Spacing.xl,
  },
  prStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  prStatItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  prStatValue: {
    fontSize: 36,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  prStatLabel: {
    fontSize: 14,
  },
  prDivider: {
    width: 1,
    height: 40,
  },
  prButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
  },
  prButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  summaryOverlay: {
    // Sits above all workout content; zIndex keeps it above sibling views.
    // No elevation needed because it's within the same RN view hierarchy.
    zIndex: 200,
  },
  summaryContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  summaryBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  summarySubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  summaryStats: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  summaryStatCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  summaryStatLabel: {
    fontSize: 12,
  },
  prSummaryBadge: {
    marginBottom: Spacing.xl,
  },
  prSummaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  prSummaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  summaryBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  summaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  summaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  shareableCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  shareCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  shareCardLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  shareCardAppName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  shareCardDate: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  shareCardContent: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  shareCardBadge: {
    marginBottom: Spacing.md,
  },
  shareCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
  },
  shareCardSubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  shareCardStats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  shareCardStat: {
    alignItems: "center",
    flex: 1,
  },
  shareCardStatValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  shareCardStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  shareCardStatDivider: {
    width: 1,
    height: 30,
  },
  shareCardPRList: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
    alignSelf: "stretch",
  },
  shareCardPR: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: BorderRadius.md,
  },
  shareCardPRText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B8860B",
    flexShrink: 1,
  },
  shareActions: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  plateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  plateModalContent: {
    width: SCREEN_WIDTH - 64,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  plateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  plateTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  plateBarSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  plateLabel: {
    fontSize: 14,
  },
  plateValue: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  plateDivider: {
    paddingVertical: Spacing.md,
  },
  plateDividerLine: {
    height: 1,
  },
  plateResultSection: {
    marginBottom: Spacing.xl,
  },
  plateResult: {
    marginTop: Spacing.md,
  },
  plateVisual: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  plateChip: {
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  plateChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  plateDescription: {
    fontSize: 15,
    fontWeight: "500",
  },
  plateCloseButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  logSection: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  logButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: "100%",
  },
  logButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  logHint: {
    fontSize: 12,
    textAlign: "center",
  },
  difficultySection: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  difficultyPrompt: {
    fontSize: 13,
    marginBottom: 2,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  difficultyBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 4,
  },
  difficultyEmoji: {
    fontSize: 22,
  },
  difficultyLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  difficultyBack: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  difficultyBackText: {
    fontSize: 13,
  },
  quickAdjustRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  quickAdjustButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickAdjustText: {
    fontSize: 13,
    fontWeight: "600",
  },
  exerciseImageWrapper: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  exerciseImageSkeleton: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseImage: {
    width: "100%",
    height: 160,
  },
  exerciseImagePlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  exerciseFallbackLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.5,
  },
  exerciseFallbackHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
  },
  exerciseFallbackHintText: {
    fontSize: 11,
  },
  exerciseMediaTouchable: {
    marginBottom: Spacing.sm,
  },
  exerciseImageInfoHint: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseNameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  swapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  swapButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  swapModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  swapModalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    maxHeight: "70%",
  },
  swapModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  swapModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  swapModalSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  swapCurrentLabel: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  swapList: {
    flex: 1,
  },
  swapEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  swapEmptyText: {
    fontSize: 15,
    textAlign: "center",
  },
  swapOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  swapOptionImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#F0F0F0",
  },
  swapOptionImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  swapOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  targetCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  targetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  targetIconContainer: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.light.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  targetTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  targetContent: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  targetWeight: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  targetReps: {
    fontSize: 16,
    fontWeight: "500",
  },
  targetReason: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  targetReasonText: {
    fontSize: 12,
  },
  firstTimeHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  completedSetInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  performanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  performanceBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});