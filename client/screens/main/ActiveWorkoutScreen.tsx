import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ActiveWorkoutRouteProp = RouteProp<RootStackParamList, "ActiveWorkout">;

type SetRating = "green" | "yellow" | "red" | null;
type RIRValue = 0 | 1 | 2 | 3;

const RIR_TO_RATING: Record<RIRValue, SetRating> = {
  0: "red",
  1: "yellow",
  2: "yellow",
  3: "green",
};

const RIR_LABELS: Record<RIRValue, string> = {
  0: "0 RIR",
  1: "1 RIR",
  2: "2 RIR",
  3: "3+ RIR",
};

const RIR_DESCRIPTIONS: Record<RIRValue, string> = {
  0: "Failure",
  1: "Very hard",
  2: "Challenging",
  3: "Comfortable",
};

function getExerciseImageUrl(exerciseName: string): string | null {
  const nameToId: Record<string, string> = {
    "Bench Press": "Barbell_Bench_Press_-_Medium_Grip",
    "Incline Dumbbell Press": "Incline_Dumbbell_Press",
    "Cable Flyes": "Cable_Crossover",
    "Dumbbell Flyes": "Dumbbell_Flyes",
    "Barbell Squat": "Barbell_Full_Squat",
    "Leg Press": "Leg_Press",
    "Leg Curl": "Lying_Leg_Curls",
    "Leg Extension": "Leg_Extensions",
    "Romanian Deadlift": "Romanian_Deadlift_With_Dumbbells",
    "Calf Raises": "Standing_Calf_Raises",
    "Pull Ups": "Pullups",
    "Lat Pulldown": "Wide-Grip_Lat_Pulldown",
    "Barbell Row": "Bent_Over_Barbell_Row",
    "Seated Cable Row": "Seated_Cable_Rows",
    "Face Pulls": "Face_Pull",
    "Overhead Press": "Standing_Military_Press",
    "Lateral Raises": "Side_Lateral_Raise",
    "Front Raises": "Front_Dumbbell_Raise",
    "Rear Delt Flyes": "Seated_Bent-Over_Rear_Delt_Raise",
    "Shrugs": "Barbell_Shrug",
    "Barbell Curl": "Barbell_Curl",
    "Dumbbell Curl": "Dumbbell_Bicep_Curl",
    "Hammer Curl": "Hammer_Curls",
    "Preacher Curl": "Preacher_Curl",
    "Tricep Pushdown": "Triceps_Pushdown",
    "Skull Crushers": "EZ-Bar_Skullcrusher",
    "Overhead Tricep Extension": "Dumbbell_One-Arm_Triceps_Extension",
    "Dips": "Dips_-_Triceps_Version",
    "Deadlift": "Barbell_Deadlift",
    "Plank": "Plank",
    "Russian Twists": "Russian_Twist",
    "Hanging Leg Raise": "Hanging_Leg_Raise",
    "Cable Crunch": "Cable_Crunch",
    "Hip Thrust": "Barbell_Hip_Thrust",
    "Lunges": "Dumbbell_Lunges",
    "Bulgarian Split Squat": "Dumbbell_Single_Leg_Split_Squat",
  };
  
  const id = nameToId[exerciseName];
  if (!id) return null;
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/0.jpg`;
}

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
  onClose,
}: {
  visible: boolean;
  duration: number;
  totalSets: number;
  completedSets: number;
  totalVolume: number;
  prs: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <ThemedView style={[styles.summaryContainer, { paddingTop: insets.top + Spacing.xl }]}>
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            style={styles.summaryBadge}
          >
            <Feather name="check-circle" size={48} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <ThemedText style={styles.summaryTitle}>Workout Complete!</ThemedText>
          <ThemedText style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
            Great job crushing it today
          </ThemedText>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={styles.summaryStats}
        >
          <View style={[styles.summaryStatCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="clock" size={24} color={Colors.light.primary} />
            <ThemedText style={styles.summaryStatValue}>
              {formatTime(duration)}
            </ThemedText>
            <ThemedText style={[styles.summaryStatLabel, { color: theme.textSecondary }]}>
              Duration
            </ThemedText>
          </View>

          <View style={[styles.summaryStatCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="check-square" size={24} color={Colors.light.primary} />
            <ThemedText style={styles.summaryStatValue}>
              {completedSets}/{totalSets}
            </ThemedText>
            <ThemedText style={[styles.summaryStatLabel, { color: theme.textSecondary }]}>
              Sets
            </ThemedText>
          </View>

          <View style={[styles.summaryStatCard, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="trending-up" size={24} color={Colors.light.primary} />
            <ThemedText style={styles.summaryStatValue}>
              {totalVolume.toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.summaryStatLabel, { color: theme.textSecondary }]}>
              kg Volume
            </ThemedText>
          </View>
        </Animated.View>

        {prs > 0 ? (
          <Animated.View
            entering={FadeInUp.delay(400).duration(400)}
            style={styles.prSummaryBadge}
          >
            <LinearGradient
              colors={["#FFD700", "#FFA500"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.prSummaryGradient}
            >
              <Feather name="award" size={20} color="#FFFFFF" />
              <ThemedText style={styles.prSummaryText}>
                {prs} New Personal Record{prs > 1 ? "s" : ""}!
              </ThemedText>
            </LinearGradient>
          </Animated.View>
        ) : null}

        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={[styles.summaryBottom, { paddingBottom: insets.bottom + Spacing.lg }]}
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
    </Modal>
  );
}

function RIRButton({
  rir,
  selected,
  onPress,
  disabled,
}: {
  rir: RIRValue;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
  const scale = useSharedValue(1);
  const rating = RIR_TO_RATING[rir] as "green" | "yellow" | "red";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.5 : 1,
  }));

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
        styles.rirButton,
        {
          backgroundColor: selected
            ? RATING_COLORS[rating]
            : RATING_COLORS[rating] + "15",
          borderColor: RATING_COLORS[rating],
          borderWidth: selected ? 0 : 1.5,
        },
      ]}
      testID={`button-rir-${rir}`}
    >
      <ThemedText
        style={[
          styles.rirValue,
          { color: selected ? "#FFFFFF" : RATING_COLORS[rating] },
        ]}
      >
        {rir === 3 ? "3+" : rir}
      </ThemedText>
      <ThemedText
        style={[
          styles.rirLabel,
          { color: selected ? "#FFFFFF" : RATING_COLORS[rating] },
        ]}
      >
        {RIR_DESCRIPTIONS[rir]}
      </ThemedText>
    </AnimatedPressable>
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
          backgroundColor: type === "increase" 
            ? Colors.light.primary + "15" 
            : theme.backgroundSecondary,
          borderColor: type === "increase" ? Colors.light.primary : theme.border,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.quickAdjustText,
          { color: type === "increase" ? Colors.light.primary : theme.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
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
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [selectedRIR, setSelectedRIR] = useState<RIRValue | null>(null);

  const progressionSuggestion = useMemo(() => {
    if (!lastWeekData || !lastWeekData.weight || !lastWeekData.rating) return null;
    const lastWeight = parseFloat(lastWeekData.weight) || 0;
    return calculateProgressionWeight(lastWeight, lastWeekData.rating);
  }, [lastWeekData]);

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

  const handleRIR = (rir: RIRValue) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedRIR(rir);
    const rating = RIR_TO_RATING[rir];
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
                Last: {lastWeekData.weight}kg x {lastWeekData.reps}
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
          {progressionSuggestion ? (
            <View style={[styles.progressionBadge, { backgroundColor: Colors.light.primary + "15" }]}>
              <Feather name="trending-up" size={12} color={Colors.light.primary} />
              <ThemedText style={[styles.progressionText, { color: Colors.light.primary }]}>
                {progressionSuggestion.message}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <PlateCalculatorModal
        visible={showPlateCalc}
        weight={parseFloat(setData.weight) || 0}
        onClose={() => setShowPlateCalc(false)}
      />

      <View style={styles.inputsRow}>
        <View style={styles.inputWrapper}>
          <View style={styles.inputLabelRow}>
            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Weight
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPlateCalc(true);
              }}
              style={[styles.plateButton, { backgroundColor: Colors.light.primary + "15" }]}
              testID={`button-plate-calc-${setIndex}`}
            >
              <Feather name="disc" size={12} color={Colors.light.primary} />
            </Pressable>
          </View>
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
          <View style={styles.quickAdjustRow}>
            <QuickAdjustButton
              label="-2.5"
              onPress={() => {
                const current = parseFloat(setData.weight) || 0;
                onUpdate({ weight: Math.max(0, current - 2.5).toString() });
              }}
              type="decrease"
            />
            <QuickAdjustButton
              label="+2.5"
              onPress={() => {
                const current = parseFloat(setData.weight) || 0;
                onUpdate({ weight: (current + 2.5).toString() });
              }}
              type="increase"
            />
            <QuickAdjustButton
              label="+5"
              onPress={() => {
                const current = parseFloat(setData.weight) || 0;
                onUpdate({ weight: (current + 5).toString() });
              }}
              type="increase"
            />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <View style={styles.inputLabelRow}>
            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Reps
            </ThemedText>
          </View>
          <View style={[styles.inputBox, { backgroundColor: theme.backgroundSecondary }]}>
            <TextInput
              ref={repsRef}
              style={[styles.inputText, { color: theme.text }]}
              value={setData.reps}
              onChangeText={(text) => onUpdate({ reps: text })}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              testID={`input-reps-${setIndex}`}
            />
          </View>
          <View style={styles.quickAdjustRow}>
            <QuickAdjustButton
              label="-1"
              onPress={() => {
                const current = parseInt(setData.reps) || 0;
                onUpdate({ reps: Math.max(0, current - 1).toString() });
              }}
              type="decrease"
            />
            <QuickAdjustButton
              label="+1"
              onPress={() => {
                const current = parseInt(setData.reps) || 0;
                onUpdate({ reps: (current + 1).toString() });
              }}
              type="increase"
            />
            <QuickAdjustButton
              label="+2"
              onPress={() => {
                const current = parseInt(setData.reps) || 0;
                onUpdate({ reps: (current + 2).toString() });
              }}
              type="increase"
            />
          </View>
        </View>
      </View>

      <View style={styles.rirSection}>
        <ThemedText style={[styles.rirQuestion, { color: theme.text }]}>
          Reps in Reserve (RIR)
        </ThemedText>
        <ThemedText style={[styles.rirHelpText, { color: theme.textSecondary }]}>
          How many more reps could you have done?
        </ThemedText>
        <View style={styles.rirButtonsRow}>
          {([0, 1, 2, 3] as RIRValue[]).map((rir) => (
            <RIRButton
              key={rir}
              rir={rir}
              selected={setData.rating === RIR_TO_RATING[rir] && selectedRIR === rir}
              onPress={() => handleRIR(rir)}
              disabled={!canRate}
            />
          ))}
        </View>
        {!canRate ? (
          <ThemedText style={[styles.rirHint, { color: theme.textSecondary }]}>
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
  const [allHistory, setAllHistory] = useState<WorkoutSession[]>([]);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(DEFAULT_REST_TIME);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [currentPR, setCurrentPR] = useState<PRRecord | null>(null);
  const [prsThisSession, setPrsThisSession] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showRestTimer && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft((prev) => {
          if (prev <= 1) {
            setShowRestTimer(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      const [plans, history] = await Promise.all([
        getWorkoutPlans(),
        getWorkoutHistory(),
      ]);

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

  const checkForPR = (exerciseName: string, weight: number, reps: number) => {
    const exerciseHistory = allHistory.flatMap((session) =>
      (session.exerciseProgress || []).flatMap((ep, idx) =>
        session.exercises[idx]?.name === exerciseName
          ? ep.sets.filter((s) => s.completed).map((s) => ({
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
      setPrsThisSession((prev) => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      setShowRestTimer(true);
      setRestTimeLeft(DEFAULT_REST_TIME);
      setCurrentSetIndex(currentSetIndex + 1);
    } else if (currentExerciseIndex < day.exercises.length - 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setCurrentSetIndex(0);
    }
  };

  const handleSkipRest = () => {
    setShowRestTimer(false);
    setRestTimeLeft(DEFAULT_REST_TIME);
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
          { text: "Finish", onPress: () => saveAndShowSummary() },
        ]
      );
    } else {
      saveAndShowSummary();
    }
  };

  const saveAndShowSummary = async () => {
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
      duration: elapsedTime,
    };

    await addWorkoutSession(session);
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
      <WorkoutSummary
        visible={showSummary}
        duration={elapsedTime}
        totalSets={totalSets}
        completedSets={completedSets}
        totalVolume={calculateTotalVolume()}
        prs={prsThisSession}
        onClose={() => navigation.goBack()}
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
              <ThemedText style={styles.dayTitle}>{day.dayName}</ThemedText>
              <View style={styles.timerBadge}>
                <Feather name="clock" size={12} color={Colors.light.primary} />
                <ThemedText style={[styles.timerBadgeText, { color: Colors.light.primary }]}>
                  {formatTime(elapsedTime)}
                </ThemedText>
              </View>
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

        <KeyboardAwareScrollView
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
              {getExerciseImageUrl(currentExercise.name) ? (
                <Image
                  source={{ uri: getExerciseImageUrl(currentExercise.name)! }}
                  style={styles.exerciseImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.exerciseImagePlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="image" size={32} color={theme.textSecondary} />
                </View>
              )}
              <ThemedText style={styles.exerciseName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                {currentExercise.name}
              </ThemedText>
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
        </KeyboardAwareScrollView>

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
  rirButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  rirValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  rirLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  rirSection: {
    alignItems: "center",
  },
  rirQuestion: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 4,
  },
  rirHelpText: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  rirButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    width: "100%",
  },
  rirHint: {
    fontSize: 12,
    marginTop: Spacing.sm,
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
  exerciseImage: {
    width: "100%",
    height: 160,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    backgroundColor: "#F0F0F0",
  },
  exerciseImagePlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
