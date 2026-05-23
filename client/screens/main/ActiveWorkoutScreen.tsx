import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
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
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Image as ExpoImage } from "expo-image";
import {
  HevySetGridHeader,
  HevySetRowWithPrefill,
} from "@/components/workout/HevySetRow";
import { isBodyweightExercise } from "@/lib/exerciseBodyweight";
import { HEVY } from "@/constants/hevyLayout";
import { WEIGHT_SLIDER_STEP_KG } from "@/lib/activeWorkoutSetFormat";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useTranslation } from "react-i18next";

import { BrandLogo } from "@/components/brand/BrandLogo";
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
  WeightRecommendation,
  getUserPreferences,
  setUserPreferences,
  mergeRestTimerPreference,
  FitnessLevel,
  FitnessGoal,
  UserPreferences,
} from "@/lib/storage";
import {
  getExerciseImageUrl,
  getMuscleGroupMeta,
} from "@/lib/exerciseImages";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";
import { prefetchWorkoutExerciseMedia } from "../../services/exerciseMedia";
import { sanitizeExerciseInstructions } from "@/services/exerciseApi";
import { ExerciseDbHeroGif } from "@/components/workout/ExerciseDbHeroGif";
import { WorkoutBannerAd } from "@/components/ads/WorkoutBannerAd";
import { repsMeetsTarget } from "@/lib/coachHelpers";
import { toast } from "@/lib/toast";
import { computeAdaptiveProgression } from "@shared/coachProgression";
import {
  buildExerciseCoachMeta,
  clearConservativeModeForExercise,
  getCoachStatesForExercises,
  recordSessionCoachOutcomes,
  type ExerciseCoachState,
} from "@/lib/coachProgressionState";
import {
  saveActiveWorkoutDraft,
  loadActiveWorkoutDraft,
  clearActiveWorkoutDraft,
  type ActiveWorkoutDraft,
} from "@/lib/activeWorkoutPersistence";
import { enqueueAndTrySyncWorkoutSession } from "@/lib/workoutSessionSyncQueue";
import {
  notchSafeTopPadding,
  HEADER_SAFE_MARGIN_TOP,
} from "@/lib/paddingTopUnderHeader";

const ACTIVE_WORKOUT_AUTOSAVE_MS = 4000;

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

function getHistoricalCompletedSetsForExercise(
  sessions: WorkoutSession[],
  exerciseName: string
): { weight: number; reps: number }[] {
  const out: { weight: number; reps: number }[] = [];
  for (const session of sessions) {
    const exList = session.exercises ?? [];
    const prog = session.exerciseProgress ?? [];
    for (let i = 0; i < exList.length; i++) {
      if ((exList[i]?.name ?? "") !== exerciseName) continue;
      const ep = prog[i];
      if (!ep?.sets) continue;
      for (const s of ep.sets) {
        if (!s.completed) continue;
        const w = parseFloat(String(s.weight).replace(",", ".")) || 0;
        const r = parseInt(String(s.reps), 10) || 0;
        if (w > 0 && r > 0) out.push({ weight: w, reps: r });
      }
    }
  }
  return out;
}

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
  const { t } = useTranslation();

  if (!visible || !pr) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.prModalOverlay}>
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={[styles.prModalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.prBadge, { backgroundColor: Colors.light.primary }]}>
            <Feather name="award" size={40} color="#FFFFFF" />
          </View>

          <View style={styles.prColumn}>
            <ThemedText style={styles.prTitle}>{t("activeWorkout.pr.title")}</ThemedText>

            <View style={styles.prExerciseWrap}>
              <ThemedText
                style={[styles.prExercise, { color: theme.text }]}
                textBreakStrategy="highQuality"
              >
                {pr.exerciseName}
              </ThemedText>
            </View>

            <View style={styles.prStatsRow}>
              <View
                style={[
                  styles.prStatBox,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText style={[styles.prStatBoxCaption, { color: theme.textSecondary }]}>
                  {t("activeWorkout.pr.weightLabel")}
                </ThemedText>
                <ThemedText
                  style={[styles.prStatBoxValue, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {pr.weight}
                </ThemedText>
                <ThemedText style={[styles.prStatBoxUnit, { color: theme.textSecondary }]}>
                  {t("common.kg")}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.prStatBox,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText style={[styles.prStatBoxCaption, { color: theme.textSecondary }]}>
                  {t("activeWorkout.pr.repsLabel")}
                </ThemedText>
                <ThemedText
                  style={[styles.prStatBoxValue, { color: theme.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {pr.reps}
                </ThemedText>
                <ThemedText style={[styles.prStatBoxUnit, { color: theme.textSecondary }]}>
                  {t("activeWorkout.pr.repsShort")}
                </ThemedText>
              </View>
            </View>

            <Pressable onPress={onClose} style={styles.prButtonWrap}>
              <View style={[styles.prButton, { backgroundColor: Colors.light.primary }]}>
                <ThemedText style={styles.prButtonText}>{t("activeWorkout.pr.cta")}</ThemedText>
              </View>
            </Pressable>
          </View>
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
          <View style={[styles.shareCardHeader, { backgroundColor: Colors.light.primary }]}>
            <BrandLogo height={28} centered={false} style={{ marginRight: 0 }} />
            <ThemedText style={styles.shareCardDate}>{today}</ThemedText>
          </View>

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
            <View style={[styles.summaryButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.summaryButtonText}>Done</ThemedText>
            </View>
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

export default function ActiveWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const workoutHeaderPaddingTop = notchSafeTopPadding(
    Platform.OS === "android"
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : insets.top,
  );
  const { theme } = useTheme();
  const { t } = useTranslation();
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
  const [workoutStartedAt, setWorkoutStartedAt] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(DEFAULT_REST_TIME);
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [currentPR, setCurrentPR] = useState<PRRecord | null>(null);
  const [prsThisSession, setPrsThisSession] = useState<PRRecord[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [nextSetCoachMessage, setNextSetCoachMessage] = useState<string | null>(null);
  const [coachStateByExercise, setCoachStateByExercise] = useState<
    Record<string, ExerciseCoachState>
  >({});
  const sessionSuggestionsRef = useRef<Record<string, number>>({});
  const navFiredRef = useRef(false);
  const isSavingRef = useRef(false);
  const timerEndTimeRef = useRef<number | null>(null);
  const scheduledNotifIdRef = useRef<string | null>(null);
  const [showExerciseDetail, setShowExerciseDetail] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [fitnessGoals, setFitnessGoals] = useState<FitnessGoal[]>([]);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [preferencesSnapshot, setPreferencesSnapshot] =
    useState<UserPreferences | null>(null);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [popupInstructions, setPopupInstructions] = useState<string[]>([]);
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
        shouldShowBanner: false,
        shouldShowList: false,
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
      setElapsedTime(Math.floor((Date.now() - workoutStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [workoutStartedAt]);

  const buildActiveWorkoutDraft = useCallback((): ActiveWorkoutDraft | null => {
    if (!plan) return null;
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      route: {
        planId: route.params.planId,
        planName: route.params.planName,
        dayIndex: route.params.dayIndex,
      },
      plan,
      progress,
      lastWeekProgress,
      currentExerciseIndex,
      currentSetIndex,
      workoutStartedAt,
      showRestTimer,
      restTimeLeft,
      restTimerEndAt: timerEndTimeRef.current,
      prsThisSession,
      coachStateByExercise,
      sessionSuggestionsByExerciseId: { ...sessionSuggestionsRef.current },
      restTimerEnabled,
    };
  }, [
    plan,
    progress,
    lastWeekProgress,
    currentExerciseIndex,
    currentSetIndex,
    workoutStartedAt,
    showRestTimer,
    restTimeLeft,
    prsThisSession,
    coachStateByExercise,
    restTimerEnabled,
    route.params.planId,
    route.params.planName,
    route.params.dayIndex,
  ]);

  const scheduleActiveWorkoutAutosave = useCallback(() => {
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      const draft = buildActiveWorkoutDraft();
      if (draft) {
        void saveActiveWorkoutDraft(draft).catch(() => {});
      }
    }, ACTIVE_WORKOUT_AUTOSAVE_MS);
  }, [buildActiveWorkoutDraft]);

  useEffect(() => {
    if (!plan || progress.length === 0 || showSummary) return;
    scheduleActiveWorkoutAutosave();
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [
    plan,
    progress,
    lastWeekProgress,
    currentExerciseIndex,
    currentSetIndex,
    workoutStartedAt,
    showRestTimer,
    restTimeLeft,
    prsThisSession,
    coachStateByExercise,
    restTimerEnabled,
    showSummary,
    scheduleActiveWorkoutAutosave,
  ]);

  const currentExerciseName =
    plan?.days[route.params.dayIndex]?.exercises[currentExerciseIndex]?.name ??
    "";
  useEffect(() => {
    setImageError(false);
    setPopupInstructions([]);
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
      setPreferencesSnapshot(prefs);
      setAllHistory(history);

      const restored = route.params.restored === true;
      if (restored) {
        const draft = await loadActiveWorkoutDraft();
        if (
          draft &&
          draft.route.planId === route.params.planId &&
          draft.route.dayIndex === route.params.dayIndex
        ) {
          setPlan(draft.plan);
          setProgress(draft.progress);
          setLastWeekProgress(draft.lastWeekProgress);
          setCurrentExerciseIndex(draft.currentExerciseIndex);
          setCurrentSetIndex(draft.currentSetIndex);
          setWorkoutStartedAt(draft.workoutStartedAt);
          setShowRestTimer(draft.showRestTimer);
          setPrsThisSession(draft.prsThisSession);
          setCoachStateByExercise(draft.coachStateByExercise);
          sessionSuggestionsRef.current = draft.sessionSuggestionsByExerciseId;
          if (draft.restTimerEnabled != null) {
            setRestTimerEnabled(draft.restTimerEnabled);
          }
          if (draft.restTimerEndAt != null) {
            timerEndTimeRef.current = draft.restTimerEndAt;
            const remaining = Math.ceil(
              (draft.restTimerEndAt - Date.now()) / 1000,
            );
            if (remaining > 0) {
              setRestTimeLeft(remaining);
            } else {
              setShowRestTimer(false);
              setRestTimeLeft(restDuration);
              timerEndTimeRef.current = null;
            }
          } else {
            setRestTimeLeft(draft.restTimeLeft);
          }
          return;
        }
      }

      const targetPlan = plans.find((p) => p.id === route.params.planId);
      if (!targetPlan) return;

      setPlan(targetPlan);

      const planExerciseNames = [
        ...new Set(
          targetPlan.days.flatMap((d) => d.exercises.map((e) => e.name)),
        ),
      ];
      prefetchWorkoutExerciseMedia(planExerciseNames);

      const day = targetPlan.days[route.params.dayIndex];

      const lastSession = history.find(
        (s) => s.planId === targetPlan.id && s.dayName === day.dayName,
      );
      const lastEpList = lastSession?.exerciseProgress ?? [];

      const coachStates = await getCoachStatesForExercises(
        day.exercises.map((e) => e.name),
      );
      setCoachStateByExercise(coachStates);

      const suggestions: Record<string, number> = {};
      for (const ex of day.exercises) {
        const lastEp = lastEpList.find((lep) => lep.exerciseId === ex.id);
        if (!lastEp?.sets?.length) continue;
        const key = ex.name.trim().toLowerCase();
        const coachState = coachStates[key] ?? {
          conservativeCyclesRemaining: 0,
          overrideStreak: 0,
        };
        const prog = computeAdaptiveProgression({
          exerciseName: ex.name,
          targetRepsLabel: ex.reps,
          targetRepsNumber: ex.targetReps,
          plannedSetCount: ex.sets,
          lastSets: lastEp.sets,
          conservativeCyclesRemaining: coachState.conservativeCyclesRemaining,
        });
        if (prog) suggestions[ex.id] = prog.suggestedWeightKg;
      }
      sessionSuggestionsRef.current = suggestions;

      const initialProgress: ExerciseProgress[] = day.exercises.map((ex) => {
        const lastEp = lastEpList.find((lep) => lep.exerciseId === ex.id);
        const sets = Array.from({ length: ex.sets }, (_, i) => {
          const lw = lastEp?.sets?.[i];
          const hasLastWeek =
            lw != null &&
            ((typeof lw.weight === "string" && lw.weight.trim() !== "") ||
              (typeof lw.reps === "string" && lw.reps.trim() !== ""));
          if (hasLastWeek) {
            return { weight: "", reps: "", rating: null, completed: false };
          }
          const w =
            ex.targetWeight != null && Number.isFinite(ex.targetWeight)
              ? String(ex.targetWeight)
              : "";
          const r =
            ex.targetReps != null && Number.isFinite(ex.targetReps)
              ? String(ex.targetReps)
              : "";
          return { weight: w, reps: r, rating: null, completed: false };
        });
        return { exerciseId: ex.id, sets };
      });
      setProgress(initialProgress);

      if (lastSession?.exerciseProgress) {
        setLastWeekProgress(lastSession.exerciseProgress);
      } else {
        setLastWeekProgress([]);
      }
    } catch (error) {
      console.error("Error loading:", error);
    }
  };

  const dayIndex = route.params.dayIndex;

  const exerciseProgressionSuggestion = useMemo((): WeightRecommendation | null => {
    if (!plan || progress.length === 0) return null;
    const day = plan.days[dayIndex];
    const ex = day.exercises[currentExerciseIndex];
    if (!ex) return null;
    const ep = progress[currentExerciseIndex];
    const lastWeekExercise = lastWeekProgress.find(
      (lep) => lep.exerciseId === ep?.exerciseId,
    );
    if (!lastWeekExercise?.sets?.length) return null;
    const key = ex.name.trim().toLowerCase();
    const coachState = coachStateByExercise[key] ?? {
      conservativeCyclesRemaining: 0,
      overrideStreak: 0,
    };
    const result = computeAdaptiveProgression({
      exerciseName: ex.name,
      targetRepsLabel: ex.reps,
      targetRepsNumber: ex.targetReps,
      plannedSetCount: ex.sets,
      lastSets: lastWeekExercise.sets,
      conservativeCyclesRemaining: coachState.conservativeCyclesRemaining,
    });
    if (!result) return null;
    return {
      recommendedWeight: result.recommendedWeight,
      recommendedReps: result.recommendedReps,
      reason: result.reason,
      confidence: result.confidence,
      contextKey: result.contextKey,
      contextParams: result.contextParams,
      suggestedWeightKg: result.suggestedWeightKg,
      previousWorkingWeightKg: result.previousWorkingWeightKg,
    };
  }, [
    plan,
    progress,
    lastWeekProgress,
    currentExerciseIndex,
    coachStateByExercise,
    dayIndex,
  ]);

  const progressionCoachLabel = useMemo(() => {
    if (!exerciseProgressionSuggestion?.contextKey) return null;
    return t(
      `activeWorkout.coach.progression.${exerciseProgressionSuggestion.contextKey}`,
      exerciseProgressionSuggestion.contextParams ?? {},
    );
  }, [exerciseProgressionSuggestion, t]);

  useEffect(() => {
    if (!exerciseProgressionSuggestion?.suggestedWeightKg || !plan) return;
    const ep = progress[currentExerciseIndex];
    if (ep) {
      sessionSuggestionsRef.current[ep.exerciseId] =
        exerciseProgressionSuggestion.suggestedWeightKg;
    }
  }, [currentExerciseIndex, exerciseProgressionSuggestion, plan, progress]);

  useEffect(() => {
    if (progressionCoachLabel) {
      setNextSetCoachMessage(progressionCoachLabel);
    } else {
      setNextSetCoachMessage(null);
    }
  }, [currentExerciseIndex, progressionCoachLabel]);

  const checkForPR = (
    exerciseName: string,
    weight: number,
    reps: number
  ) => {
    const exerciseHistory = getHistoricalCompletedSetsForExercise(
      allHistory,
      exerciseName
    );

    if (exerciseHistory.length === 0) {
      return;
    }

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
          i === currentSetIndex ? { ...s, ...data } : s,
        ),
      };
      return updated;
    });
  };

  const persistRestTimerPreference = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestTimerEnabled(value);
    if (!value) {
      cancelRestNotification();
      setShowRestTimer(false);
    }
    const updated = mergeRestTimerPreference(preferencesSnapshot, value);
    setPreferencesSnapshot(updated);
    await setUserPreferences(updated);
    toast.show(
      value ? "Timer eingeschaltet" : "Timer ausgeschaltet",
      "info",
      1500,
    );
  };

  const handleSetComplete = (payload: {
    rating: SetRating;
    reps: number;
    targetMet: boolean;
  }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

    const moreSetsInExercise = currentSetIndex < currentExercise.sets - 1;
    if (payload.rating === "green") {
      const key = currentExercise.name.trim().toLowerCase();
      void clearConservativeModeForExercise(currentExercise.name);
      setCoachStateByExercise((prev) => ({
        ...prev,
        [key]: { conservativeCyclesRemaining: 0, overrideStreak: 0 },
      }));
    }
    if (
      moreSetsInExercise &&
      payload.rating === "green" &&
      payload.targetMet &&
      exerciseProgressionSuggestion?.confidence === "increase"
    ) {
      setNextSetCoachMessage(
        t("activeWorkout.coach.nextSetPlusWeight", { kg: WEIGHT_SLIDER_STEP_KG }),
      );
    } else if (progressionCoachLabel) {
      setNextSetCoachMessage(progressionCoachLabel);
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
    const enrichedProgress = progress.map((ep, idx) => {
      const suggested =
        sessionSuggestionsRef.current[ep.exerciseId] ??
        exerciseProgressionSuggestion?.suggestedWeightKg ??
        0;
      if (suggested <= 0) return ep;
      return {
        ...ep,
        coachMeta: buildExerciseCoachMeta(ep.sets, suggested),
      };
    });

    const session: WorkoutSession = {
      id: Date.now().toString(),
      planId: plan.id,
      planName: plan.name,
      dayName: day.dayName,
      completedAt: new Date().toISOString(),
      exercises: day.exercises,
      exerciseProgress: enrichedProgress,
      duration: elapsedTime,
    };

    try {
      await addWorkoutSession(session);
      await recordSessionCoachOutcomes(
        day.exercises.map((e) => ({ id: e.id, name: e.name })),
        enrichedProgress,
        sessionSuggestionsRef.current,
      );
    } catch (error) {
      console.error("Failed to save workout locally:", error);
      Alert.alert(
        "Save Error",
        "Your workout couldn't be saved to storage. Your results are still shown below.",
        [{ text: "OK" }],
      );
    }

    void clearActiveWorkoutDraft().catch(() => {});
    void enqueueAndTrySyncWorkoutSession(session).catch(() => {});

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

      <View style={styles.mainContainer} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          style={[
            styles.header,
            {
              paddingTop: workoutHeaderPaddingTop,
              marginTop: HEADER_SAFE_MARGIN_TOP,
              paddingBottom: Spacing.md,
              backgroundColor: theme.backgroundRoot,
            },
          ]}
        >
          <View style={styles.headerTop} pointerEvents="box-none">
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              testID="button-back"
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <View style={styles.headerInfo}>
              <ThemedText
                style={styles.dayTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
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
            {/* Pausen-Timer: oben rechts im Header (neben Session-Uhr). Auch unter Profil → gleiche Einstellung. */}
            <View style={styles.headerRestToggle}>
              <View style={styles.headerRestToggleInner}>
                <Feather
                  name="clock"
                  size={15}
                  color={restTimerEnabled ? Colors.light.primary : theme.textSecondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Switch
                  value={restTimerEnabled}
                  onValueChange={persistRestTimerPreference}
                  trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E5EA"
                  style={styles.headerRestSwitch}
                  testID="switch-rest-timer-header"
                  accessibilityLabel="Pausen-Timer"
                  accessibilityHint="Schaltet den automatischen Countdown nach jedem abgeschlossenen Satz ein oder aus."
                  accessibilityState={{ checked: restTimerEnabled }}
                />
              </View>
              <ThemedText
                style={[styles.headerRestCaption, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                Pause
              </ThemedText>
            </View>
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
                <View
                  style={[styles.progressGradient, { backgroundColor: Colors.light.primary }]}
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
            <ExerciseDbHeroGif
              exerciseName={currentExercise.name}
              muscleGroup={currentExercise.muscleGroup}
              style={styles.exerciseHeroGif}
            />

            <View style={styles.exerciseHeader} pointerEvents="box-none">
              <View style={styles.exerciseHeaderRow} pointerEvents="box-none">
                <View style={styles.exerciseHeaderText} pointerEvents="box-none">
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
                    <ThemedText
                      style={[styles.metaMuscleLabel, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {currentExercise.muscleGroup}
                    </ThemedText>
                    <ThemedText
                      style={[styles.targetSetsLine, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {currentExercise.sets} sets × {currentExercise.reps} reps
                    </ThemedText>
                  </View>
                </View>

                {(() => {
                  const staticUrl = getExerciseImageUrl(currentExercise.name);
                  const meta = getMuscleGroupMeta(currentExercise.muscleGroup);
                  return (
                    <View style={styles.exerciseThumbnailTouchLayer} collapsable={false}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setGifModalVisible(true);
                        }}
                        style={[
                          styles.exerciseThumbnail,
                          { backgroundColor: meta.color + "12" },
                        ]}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel={`${currentExercise.name} demonstration öffnen`}
                        testID="button-exercise-thumbnail"
                      >
                        {staticUrl && !imageError ? (
                          <Image
                            source={{ uri: staticUrl }}
                            style={styles.exerciseThumbnailImage}
                            resizeMode="cover"
                            onError={() => setImageError(true)}
                          />
                        ) : (
                          <Feather name={meta.icon as any} size={18} color={meta.color} />
                        )}
                      </Pressable>
                    </View>
                  );
                })()}
              </View>
            </View>


            {nextSetCoachMessage ? (
              <View
                style={[
                  styles.coachHintBanner,
                  {
                    borderColor: Colors.light.primary + "33",
                    backgroundColor: Colors.light.primary + "10",
                  },
                ]}
              >
                <Feather name="zap" size={14} color={Colors.light.primary} />
                <ThemedText style={[styles.coachHintText, { color: theme.text }]}>
                  {nextSetCoachMessage}
                </ThemedText>
              </View>
            ) : null}

            <View
              style={[
                styles.setsContainer,
                {
                  backgroundColor: HEVY.surface,
                  overflow: "hidden",
                },
              ]}
            >
              <HevySetGridHeader
                isBodyweight={isBodyweightExercise(currentExercise)}
              />
              {exerciseProgress.sets.map((setData, index) => (
                <HevySetRowWithPrefill
                  key={index}
                  setIndex={index}
                  setData={setData}
                  lastWeekData={lastWeekExercise?.sets[index] || null}
                  isBodyweight={isBodyweightExercise(currentExercise)}
                  isActive={index === currentSetIndex}
                  targetReps={
                    currentExercise.targetReps != null &&
                    Number.isFinite(currentExercise.targetReps)
                      ? String(currentExercise.targetReps)
                      : currentExercise.reps
                  }
                  progressionWeight={
                    exerciseProgressionSuggestion?.recommendedWeight ?? null
                  }
                  progressionReps={
                    exerciseProgressionSuggestion?.recommendedReps ?? null
                  }
                  onUpdate={handleUpdateSet}
                  onComplete={handleSetComplete}
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
              <View
                style={[styles.nextButton, { backgroundColor: Colors.light.primary }]}
              >
                <ThemedText style={styles.nextButtonText}>
                  Next Exercise
                </ThemedText>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
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
              <View style={[styles.finishButton, { backgroundColor: Colors.light.primary }]}>
                <Feather name="check" size={20} color="#FFFFFF" />
                <ThemedText style={styles.finishButtonText}>
                  Finish Workout
                </ThemedText>
              </View>
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
        <WorkoutBannerAd />
      </View>
      <Modal
        visible={gifModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGifModalVisible(false)}
      >
        <View style={styles.gifModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setGifModalVisible(false)}
            accessibilityLabel="Schließen"
          />
          <View style={styles.gifModalCard} pointerEvents="box-none">
            <Pressable
              onPress={() => setGifModalVisible(false)}
              style={styles.gifModalCloseButton}
              hitSlop={12}
              testID="button-gif-popup-close"
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Feather name="x" size={26} color="#FFFFFF" />
            </Pressable>
            <View style={styles.gifModalMediaFrame}>
              <ExerciseDbHeroGif
                exerciseName={currentExercise.name}
                muscleGroup={currentExercise.muscleGroup}
                height={320}
                dark
                style={styles.gifModalHero}
                onDetailLoaded={(detail) => {
                  setPopupInstructions(sanitizeExerciseInstructions(detail.instructions));
                }}
              />
            </View>
            <Text style={styles.gifModalName}>{currentExercise.name}</Text>
            {popupInstructions.length > 0 ? (
              <ScrollView
                style={styles.gifModalInstructionsScroll}
                showsVerticalScrollIndicator={false}
              >
                {popupInstructions.map((step, index) => (
                  <View key={`${index}-${step.slice(0, 24)}`} style={styles.gifModalInstructionRow}>
                    <Text style={styles.gifModalInstructionIndex}>{index + 1}</Text>
                    <Text style={styles.gifModalInstructionText}>{step}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.gifModalHint}>
                No coaching steps available for this exercise.
              </Text>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: Spacing.sm,
    minWidth: 0,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    width: "100%",
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
  exerciseHeroGif: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  exerciseHeader: {
    paddingTop: 0,
    marginBottom: Spacing.xl,
  },
  exerciseHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    pointerEvents: "box-none",
  },
  exerciseHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  exerciseThumbnailTouchLayer: {
    zIndex: 999,
    elevation: 999,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  exerciseThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "#E5E5EA",
  },
  setCompleteCheckbox: {
    borderWidth: 1,
  },
  exerciseThumbnailImage: {
    width: 36,
    height: 36,
  },
  exerciseName: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  exerciseMeta: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 2,
  },
  metaMuscleLabel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  targetSetsLine: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  coachHintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  coachHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  setsContainer: {
    marginTop: Spacing.sm,
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
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.sm,
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
    borderRadius: BorderRadius.sm,
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
  sliderValueHero: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
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
    borderRadius: BorderRadius.sm,
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
  manualModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  manualModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  manualModalCard: {
    width: "100%",
    maxWidth: SCREEN_WIDTH - 40,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  manualModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  manualModalHint: {
    fontSize: 13,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  manualModalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  manualModalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  manualModalBtnGhost: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  manualModalBtnPrimary: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  manualModalBtnGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  manualModalBtnPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  headerRestToggle: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 76,
    maxWidth: 100,
  },
  headerRestToggleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerRestCaption: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headerRestSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  prModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  prModalContent: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  prBadge: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  prColumn: {
    width: "100%",
    alignItems: "stretch",
    gap: Spacing.lg,
  },
  prTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    width: "100%",
  },
  prExerciseWrap: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  prExercise: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
    width: "100%",
    flexWrap: "wrap",
  },
  prStatsRow: {
    flexDirection: "row",
    width: "100%",
    gap: Spacing.md,
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  prStatBox: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 108,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    overflow: "hidden",
  },
  prStatBoxCaption: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  prStatBoxValue: {
    fontSize: 28,
    fontWeight: "800",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    width: "100%",
    maxWidth: "100%",
  },
  prStatBoxUnit: {
    fontSize: 14,
    fontWeight: "500",
  },
  prButtonWrap: {
    width: "100%",
    marginTop: Spacing.sm,
  },
  prButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: BorderRadius.sm,
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
  logButtonWrapper: {
    alignSelf: "center",
    minWidth: 180,
    marginTop: 16,
  },
  logButton: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
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
  exerciseNameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
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
  gifModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  gifModalCard: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  gifModalCloseButton: {
    position: "absolute",
    top: -8,
    right: -4,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  gifModalMediaFrame: {
    width: "100%",
    height: 320,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  gifModalHero: {
    width: "100%",
    borderRadius: BorderRadius.lg,
  },
  gifModalName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: Spacing.md,
    textAlign: "center",
  },
  gifModalHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  gifModalInstructionsScroll: {
    maxHeight: 140,
    width: "100%",
    marginTop: Spacing.sm,
  },
  gifModalInstructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  gifModalInstructionIndex: {
    width: 22,
    fontSize: 13,
    fontWeight: "700",
    color: "#34C759",
    textAlign: "center",
  },
  gifModalInstructionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.88)",
  },
  gifModalError: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: Spacing.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
});
