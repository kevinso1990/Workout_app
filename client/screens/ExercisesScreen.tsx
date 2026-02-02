import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWorkoutHistory, WorkoutSession } from "@/lib/storage";

const SCREEN_WIDTH = Dimensions.get("window").width;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ExerciseItem {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  isCustom?: boolean;
}

interface APIExercise {
  name: string;
  force: string;
  level: string;
  mechanic: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
}

const CUSTOM_EXERCISES_KEY = "@fitplan_custom_exercises";

const EXERCISE_LIBRARY: ExerciseItem[] = [
  { id: "1", name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { id: "2", name: "Incline Dumbbell Press", muscleGroup: "Chest", equipment: "Dumbbells" },
  { id: "3", name: "Decline Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
  { id: "4", name: "Cable Flyes", muscleGroup: "Chest", equipment: "Cable" },
  { id: "5", name: "Push-ups", muscleGroup: "Chest", equipment: "Bodyweight" },
  { id: "6", name: "Dumbbell Flyes", muscleGroup: "Chest", equipment: "Dumbbells" },
  { id: "7", name: "Chest Dips", muscleGroup: "Chest", equipment: "Bodyweight" },
  { id: "8", name: "Machine Chest Press", muscleGroup: "Chest", equipment: "Machine" },
  { id: "9", name: "Pec Deck", muscleGroup: "Chest", equipment: "Machine" },
  { id: "10", name: "Landmine Press", muscleGroup: "Chest", equipment: "Barbell" },
  { id: "11", name: "Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "12", name: "Front Squat", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "13", name: "Leg Press", muscleGroup: "Legs", equipment: "Machine" },
  { id: "14", name: "Lunges", muscleGroup: "Legs", equipment: "Dumbbells" },
  { id: "15", name: "Bulgarian Split Squat", muscleGroup: "Legs", equipment: "Dumbbells" },
  { id: "16", name: "Leg Extension", muscleGroup: "Legs", equipment: "Machine" },
  { id: "17", name: "Leg Curl", muscleGroup: "Legs", equipment: "Machine" },
  { id: "18", name: "Romanian Deadlift", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "19", name: "Goblet Squat", muscleGroup: "Legs", equipment: "Dumbbells" },
  { id: "20", name: "Hack Squat", muscleGroup: "Legs", equipment: "Machine" },
  { id: "21", name: "Step-ups", muscleGroup: "Legs", equipment: "Dumbbells" },
  { id: "22", name: "Hip Thrust", muscleGroup: "Legs", equipment: "Barbell" },
  { id: "23", name: "Calf Raises", muscleGroup: "Legs", equipment: "Machine" },
  { id: "24", name: "Seated Calf Raises", muscleGroup: "Legs", equipment: "Machine" },
  { id: "25", name: "Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { id: "26", name: "Sumo Deadlift", muscleGroup: "Back", equipment: "Barbell" },
  { id: "27", name: "Barbell Rows", muscleGroup: "Back", equipment: "Barbell" },
  { id: "28", name: "Pendlay Rows", muscleGroup: "Back", equipment: "Barbell" },
  { id: "29", name: "Dumbbell Rows", muscleGroup: "Back", equipment: "Dumbbells" },
  { id: "30", name: "Lat Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { id: "31", name: "Pull-ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { id: "32", name: "Chin-ups", muscleGroup: "Back", equipment: "Bodyweight" },
  { id: "33", name: "Seated Cable Row", muscleGroup: "Back", equipment: "Cable" },
  { id: "34", name: "T-Bar Row", muscleGroup: "Back", equipment: "Barbell" },
  { id: "35", name: "Machine Row", muscleGroup: "Back", equipment: "Machine" },
  { id: "36", name: "Straight Arm Pulldown", muscleGroup: "Back", equipment: "Cable" },
  { id: "37", name: "Shrugs", muscleGroup: "Back", equipment: "Dumbbells" },
  { id: "38", name: "Hyperextensions", muscleGroup: "Back", equipment: "Bodyweight" },
  { id: "39", name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { id: "40", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "41", name: "Arnold Press", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "42", name: "Lateral Raises", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "43", name: "Cable Lateral Raises", muscleGroup: "Shoulders", equipment: "Cable" },
  { id: "44", name: "Front Raises", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "45", name: "Face Pulls", muscleGroup: "Shoulders", equipment: "Cable" },
  { id: "46", name: "Reverse Flyes", muscleGroup: "Shoulders", equipment: "Dumbbells" },
  { id: "47", name: "Upright Rows", muscleGroup: "Shoulders", equipment: "Barbell" },
  { id: "48", name: "Machine Shoulder Press", muscleGroup: "Shoulders", equipment: "Machine" },
  { id: "49", name: "Push Press", muscleGroup: "Shoulders", equipment: "Barbell" },
  { id: "50", name: "Bicep Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "51", name: "Barbell Curls", muscleGroup: "Arms", equipment: "Barbell" },
  { id: "52", name: "Hammer Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "53", name: "Preacher Curls", muscleGroup: "Arms", equipment: "Barbell" },
  { id: "54", name: "Concentration Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "55", name: "Cable Curls", muscleGroup: "Arms", equipment: "Cable" },
  { id: "56", name: "Incline Dumbbell Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "57", name: "Spider Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "58", name: "Tricep Pushdowns", muscleGroup: "Arms", equipment: "Cable" },
  { id: "59", name: "Skull Crushers", muscleGroup: "Arms", equipment: "Barbell" },
  { id: "60", name: "Overhead Tricep Extension", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "61", name: "Tricep Dips", muscleGroup: "Arms", equipment: "Bodyweight" },
  { id: "62", name: "Close Grip Bench Press", muscleGroup: "Arms", equipment: "Barbell" },
  { id: "63", name: "Diamond Push-ups", muscleGroup: "Arms", equipment: "Bodyweight" },
  { id: "64", name: "Tricep Kickbacks", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "65", name: "Rope Pushdowns", muscleGroup: "Arms", equipment: "Cable" },
  { id: "66", name: "Wrist Curls", muscleGroup: "Arms", equipment: "Dumbbells" },
  { id: "67", name: "Crunches", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "68", name: "Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "69", name: "Russian Twists", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "70", name: "Leg Raises", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "71", name: "Hanging Leg Raises", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "72", name: "Ab Wheel Rollout", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "73", name: "Cable Crunches", muscleGroup: "Core", equipment: "Cable" },
  { id: "74", name: "Mountain Climbers", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "75", name: "Dead Bug", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "76", name: "Bird Dog", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "77", name: "Side Plank", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "78", name: "Bicycle Crunches", muscleGroup: "Core", equipment: "Bodyweight" },
  { id: "79", name: "Kettlebell Swings", muscleGroup: "Full Body", equipment: "Kettlebell" },
  { id: "80", name: "Clean and Press", muscleGroup: "Full Body", equipment: "Barbell" },
  { id: "81", name: "Thrusters", muscleGroup: "Full Body", equipment: "Barbell" },
  { id: "82", name: "Burpees", muscleGroup: "Full Body", equipment: "Bodyweight" },
  { id: "83", name: "Box Jumps", muscleGroup: "Full Body", equipment: "Bodyweight" },
  { id: "84", name: "Battle Ropes", muscleGroup: "Full Body", equipment: "Cable" },
  { id: "85", name: "Farmers Walk", muscleGroup: "Full Body", equipment: "Dumbbells" },
];

const MUSCLE_GROUPS = ["All", "Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Full Body"];
const EQUIPMENT_OPTIONS = ["Barbell", "Dumbbells", "Cable", "Machine", "Bodyweight", "Kettlebell", "Other"];

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected
            ? Colors.light.primary
            : theme.backgroundDefault,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.filterChipText,
          { color: selected ? "#FFFFFF" : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ExerciseCard({
  exercise,
  index,
  onLongPress,
  onPress,
}: {
  exercise: ExerciseItem;
  index: number;
  onLongPress?: () => void;
  onPress?: () => void;
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const getMuscleGroupColor = (group: string) => {
    const colors: Record<string, string> = {
      Chest: "#FF6B6B",
      Back: "#4ECDC4",
      Shoulders: "#45B7D1",
      Legs: "#96CEB4",
      Arms: "#DDA0DD",
      Core: "#FFB347",
      "Full Body": Colors.light.primary,
    };
    return colors[group] || Colors.light.primary;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(300)}
      style={styles.cardWrapper}
    >
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          styles.exerciseCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`card-exercise-${exercise.id}`}
      >
        <View
          style={[
            styles.exerciseIcon,
            { backgroundColor: getMuscleGroupColor(exercise.muscleGroup) + "20" },
          ]}
        >
          <Feather
            name={exercise.isCustom ? "star" : "activity"}
            size={24}
            color={getMuscleGroupColor(exercise.muscleGroup)}
          />
        </View>
        <ThemedText style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </ThemedText>
        <View
          style={[
            styles.muscleTag,
            { backgroundColor: getMuscleGroupColor(exercise.muscleGroup) + "20" },
          ]}
        >
          <ThemedText
            style={[
              styles.muscleTagText,
              { color: getMuscleGroupColor(exercise.muscleGroup) },
            ]}
          >
            {exercise.muscleGroup}
          </ThemedText>
        </View>
        <ThemedText
          style={[styles.equipmentText, { color: theme.textSecondary }]}
        >
          {exercise.equipment}
        </ThemedText>
        {exercise.isCustom ? (
          <View style={[styles.customBadge, { backgroundColor: Colors.light.primary + "20" }]}>
            <ThemedText style={[styles.customBadgeText, { color: Colors.light.primary }]}>
              Custom
            </ThemedText>
          </View>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

function CreateExerciseModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (exercise: Omit<ExerciseItem, "id">) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("Chest");
  const [equipment, setEquipment] = useState("Barbell");

  const handleSave = () => {
    if (name.trim()) {
      onSave({ name: name.trim(), muscleGroup, equipment, isCustom: true });
      setName("");
      setMuscleGroup("Chest");
      setEquipment("Barbell");
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Create Custom Exercise</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <ThemedText style={[styles.formLabel, { color: theme.textSecondary }]}>
                Exercise Name
              </ThemedText>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Single Arm Cable Row"
                placeholderTextColor={theme.textSecondary}
                testID="input-exercise-name"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.formLabel, { color: theme.textSecondary }]}>
                Muscle Group
              </ThemedText>
              <View style={styles.optionsGrid}>
                {MUSCLE_GROUPS.filter(g => g !== "All").map((group) => (
                  <Pressable
                    key={group}
                    onPress={() => setMuscleGroup(group)}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: muscleGroup === group ? Colors.light.primary : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionChipText,
                        { color: muscleGroup === group ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {group}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={[styles.formLabel, { color: theme.textSecondary }]}>
                Equipment
              </ThemedText>
              <View style={styles.optionsGrid}>
                {EQUIPMENT_OPTIONS.map((equip) => (
                  <Pressable
                    key={equip}
                    onPress={() => setEquipment(equip)}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: equipment === equip ? Colors.light.primary : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.optionChipText,
                        { color: equipment === equip ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {equip}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={handleSave}
            style={[styles.saveButton, { opacity: name.trim() ? 1 : 0.5 }]}
            disabled={!name.trim()}
            testID="button-save-exercise"
          >
            <ThemedText style={styles.saveButtonText}>Create Exercise</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function APISearchModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Omit<ExerciseItem, "id">) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<APIExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [allExercises, setAllExercises] = useState<APIExercise[]>([]);

  useEffect(() => {
    if (visible && allExercises.length === 0) {
      fetchExercises();
    }
  }, [visible]);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json"
      );
      const data = await response.json();
      setAllExercises(data);
      setResults(data.slice(0, 20));
    } catch (error) {
      console.error("Error fetching exercises:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() && allExercises.length > 0) {
      const filtered = allExercises
        .filter((ex) =>
          ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ex.primaryMuscles.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .slice(0, 30);
      setResults(filtered);
    } else if (allExercises.length > 0) {
      setResults(allExercises.slice(0, 20));
    }
  }, [searchQuery, allExercises]);

  const mapMuscleGroup = (muscles: string[]): string => {
    const muscle = muscles[0]?.toLowerCase() || "";
    if (muscle.includes("chest") || muscle.includes("pectorals")) return "Chest";
    if (muscle.includes("back") || muscle.includes("lats") || muscle.includes("traps")) return "Back";
    if (muscle.includes("shoulder") || muscle.includes("delt")) return "Shoulders";
    if (muscle.includes("quad") || muscle.includes("hamstring") || muscle.includes("glute") || muscle.includes("calf")) return "Legs";
    if (muscle.includes("bicep") || muscle.includes("tricep") || muscle.includes("forearm")) return "Arms";
    if (muscle.includes("ab") || muscle.includes("core") || muscle.includes("oblique")) return "Core";
    return "Full Body";
  };

  const mapEquipment = (equip: string | null): string => {
    if (!equip) return "Bodyweight";
    const e = equip.toLowerCase();
    if (e.includes("barbell")) return "Barbell";
    if (e.includes("dumbbell")) return "Dumbbells";
    if (e.includes("cable")) return "Cable";
    if (e.includes("machine")) return "Machine";
    if (e.includes("kettlebell")) return "Kettlebell";
    if (e === "body only" || e === "body weight") return "Bodyweight";
    return "Other";
  };

  const handleSelect = (exercise: APIExercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect({
      name: exercise.name,
      muscleGroup: mapMuscleGroup(exercise.primaryMuscles),
      equipment: mapEquipment(exercise.equipment),
      isCustom: true,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Search Exercise Database</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.apiSearchContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.apiSearchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search 800+ exercises..."
              placeholderTextColor={theme.textSecondary}
              testID="input-api-search"
            />
          </View>

          <ThemedText style={[styles.apiSubtitle, { color: theme.textSecondary }]}>
            Tap an exercise to add it to your library
          </ThemedText>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                Loading exercise database...
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[styles.apiResultItem, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <View style={styles.apiResultInfo}>
                    <ThemedText style={styles.apiResultName}>{item.name}</ThemedText>
                    <ThemedText style={[styles.apiResultMeta, { color: theme.textSecondary }]}>
                      {item.primaryMuscles.join(", ")} • {item.equipment || "Bodyweight"}
                    </ThemedText>
                  </View>
                  <Feather name="plus-circle" size={24} color={Colors.light.primary} />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.apiResultsList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

interface ExerciseStats {
  totalSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; volume: number } | null;
  recentSessions: { date: string; volume: number; sets: number }[];
  volumeTrend: number;
}

function ExerciseProgressModal({
  visible,
  exercise,
  onClose,
  history,
}: {
  visible: boolean;
  exercise: ExerciseItem | null;
  onClose: () => void;
  history: WorkoutSession[];
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const stats = useMemo<ExerciseStats | null>(() => {
    if (!exercise || !history.length) return null;

    const exerciseSessions: { date: string; sets: { weight: number; reps: number }[] }[] = [];

    history.forEach((session) => {
      session.exercises.forEach((ex, exIdx) => {
        if (ex.name.toLowerCase() === exercise.name.toLowerCase()) {
          const progress = session.exerciseProgress?.[exIdx];
          if (progress) {
            const completedSets = progress.sets
              .filter((s) => s.completed)
              .map((s) => ({
                weight: parseFloat(s.weight) || 0,
                reps: parseInt(s.reps) || 0,
              }));
            if (completedSets.length > 0) {
              exerciseSessions.push({
                date: session.completedAt,
                sets: completedSets,
              });
            }
          }
        }
      });
    });

    if (exerciseSessions.length === 0) return null;

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    let bestSet: { weight: number; reps: number; volume: number } | null = null;

    const recentSessions = exerciseSessions.slice(0, 10).map((session) => {
      let sessionVolume = 0;
      session.sets.forEach((set) => {
        const volume = set.weight * set.reps;
        sessionVolume += volume;
        totalVolume += volume;
        totalSets++;
        totalReps += set.reps;

        if (!bestSet || volume > bestSet.volume) {
          bestSet = { weight: set.weight, reps: set.reps, volume };
        }
      });
      return {
        date: session.date,
        volume: sessionVolume,
        sets: session.sets.length,
      };
    });

    const volumeTrend =
      recentSessions.length >= 2
        ? ((recentSessions[0].volume - recentSessions[recentSessions.length - 1].volume) /
            recentSessions[recentSessions.length - 1].volume) *
          100
        : 0;

    return {
      totalSessions: exerciseSessions.length,
      totalSets,
      totalReps,
      totalVolume,
      bestSet,
      recentSessions: recentSessions.reverse(),
      volumeTrend: isFinite(volumeTrend) ? volumeTrend : 0,
    };
  }, [exercise, history]);

  const maxVolume = stats
    ? Math.max(...stats.recentSessions.map((s) => s.volume), 1)
    : 1;

  if (!exercise) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.progressModalContent,
            { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.modalTitle}>{exercise.name}</ThemedText>
              <ThemedText style={[styles.progressSubtitle, { color: theme.textSecondary }]}>
                {exercise.muscleGroup} • {exercise.equipment}
              </ThemedText>
            </View>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {stats ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="calendar" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.statValue}>{stats.totalSessions}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Sessions
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="layers" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.statValue}>{stats.totalSets}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Total Sets
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="repeat" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.statValue}>{stats.totalReps}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Total Reps
                  </ThemedText>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="bar-chart-2" size={20} color={Colors.light.primary} />
                  <ThemedText style={styles.statValue}>
                    {stats.totalVolume >= 1000
                      ? `${(stats.totalVolume / 1000).toFixed(1)}t`
                      : `${stats.totalVolume}kg`}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                    Total Volume
                  </ThemedText>
                </View>
              </View>

              {stats.bestSet ? (
                <View style={[styles.prCard, { backgroundColor: Colors.light.primary + "15" }]}>
                  <View style={styles.prHeader}>
                    <Feather name="award" size={24} color={Colors.light.primary} />
                    <ThemedText style={[styles.prTitle, { color: Colors.light.primary }]}>
                      Personal Record
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.prValue}>
                    {stats.bestSet.weight}kg x {stats.bestSet.reps} reps
                  </ThemedText>
                  <ThemedText style={[styles.prVolume, { color: theme.textSecondary }]}>
                    Volume: {stats.bestSet.volume}kg
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.trendSection}>
                <View style={styles.trendHeader}>
                  <ThemedText style={styles.sectionTitle}>Volume Trend</ThemedText>
                  {stats.volumeTrend !== 0 ? (
                    <View
                      style={[
                        styles.trendBadge,
                        { backgroundColor: stats.volumeTrend > 0 ? "#4CAF50" + "20" : "#FF5252" + "20" },
                      ]}
                    >
                      <Feather
                        name={stats.volumeTrend > 0 ? "trending-up" : "trending-down"}
                        size={14}
                        color={stats.volumeTrend > 0 ? "#4CAF50" : "#FF5252"}
                      />
                      <ThemedText
                        style={[
                          styles.trendText,
                          { color: stats.volumeTrend > 0 ? "#4CAF50" : "#FF5252" },
                        ]}
                      >
                        {stats.volumeTrend > 0 ? "+" : ""}
                        {stats.volumeTrend.toFixed(0)}%
                      </ThemedText>
                    </View>
                  ) : null}
                </View>

                <View style={styles.chartContainer}>
                  {stats.recentSessions.map((session, idx) => (
                    <View key={idx} style={styles.chartBar}>
                      <View style={styles.barContainer}>
                        <LinearGradient
                          colors={[Colors.light.primary, Colors.light.primaryDark]}
                          style={[
                            styles.bar,
                            { height: `${(session.volume / maxVolume) * 100}%` },
                          ]}
                        />
                      </View>
                      <ThemedText style={[styles.barLabel, { color: theme.textSecondary }]}>
                        {new Date(session.date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.historySection}>
                <ThemedText style={styles.sectionTitle}>Recent Sessions</ThemedText>
                {stats.recentSessions
                  .slice()
                  .reverse()
                  .map((session, idx) => (
                    <View
                      key={idx}
                      style={[styles.historyItem, { backgroundColor: theme.backgroundSecondary }]}
                    >
                      <View style={styles.historyLeft}>
                        <ThemedText style={styles.historyDate}>
                          {new Date(session.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </ThemedText>
                        <ThemedText style={[styles.historySets, { color: theme.textSecondary }]}>
                          {session.sets} sets
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.historyVolume, { color: Colors.light.primary }]}>
                        {session.volume}kg
                      </ThemedText>
                    </View>
                  ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.noDataContainer}>
              <Feather name="bar-chart" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.noDataText, { color: theme.textSecondary }]}>
                No workout data yet
              </ThemedText>
              <ThemedText style={[styles.noDataSubtext, { color: theme.textSecondary }]}>
                Complete a workout with this exercise to see your progress
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function ExercisesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [customExercises, setCustomExercises] = useState<ExerciseItem[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    loadCustomExercises();
    loadWorkoutHistory();
  }, []);

  const loadWorkoutHistory = async () => {
    try {
      const history = await getWorkoutHistory();
      setWorkoutHistory(history);
    } catch (error) {
      console.error("Error loading workout history:", error);
    }
  };

  const loadCustomExercises = async () => {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
      if (stored) {
        setCustomExercises(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading custom exercises:", error);
    }
  };

  const saveCustomExercise = async (exercise: Omit<ExerciseItem, "id">) => {
    const newExercise: ExerciseItem = {
      ...exercise,
      id: `custom-${Date.now()}`,
    };
    const updated = [...customExercises, newExercise];
    setCustomExercises(updated);
    await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const deleteCustomExercise = async (id: string) => {
    const updated = customExercises.filter((ex) => ex.id !== id);
    setCustomExercises(updated);
    await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(updated));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const allExercises = useMemo(() => {
    return [...customExercises, ...EXERCISE_LIBRARY];
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    return allExercises.filter((exercise) => {
      const matchesSearch = exercise.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter =
        selectedFilter === "All" || exercise.muscleGroup === selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, selectedFilter, allExercises]);

  const handleFilterPress = (filter: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ExerciseItem;
    index: number;
  }) => (
    <ExerciseCard
      exercise={item}
      index={index}
      onLongPress={item.isCustom ? () => deleteCustomExercise(item.id) : undefined}
      onPress={() => setSelectedExercise(item)}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <CreateExerciseModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={saveCustomExercise}
      />
      <APISearchModal
        visible={showAPIModal}
        onClose={() => setShowAPIModal(false)}
        onSelect={saveCustomExercise}
      />
      <ExerciseProgressModal
        visible={selectedExercise !== null}
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        history={workoutHistory}
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredExercises}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <View style={styles.actionButtons}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowCreateModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: Colors.light.primary }]}
                testID="button-create-exercise"
              >
                <Feather name="plus" size={18} color="#FFFFFF" />
                <ThemedText style={styles.actionButtonText}>Create</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowAPIModal(true);
                }}
                style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
                testID="button-search-database"
              >
                <Feather name="database" size={18} color={Colors.light.primary} />
                <ThemedText style={[styles.actionButtonText, { color: Colors.light.primary }]}>
                  Browse 800+
                </ThemedText>
              </Pressable>
            </View>
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search exercises..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="input-search-exercises"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              horizontal
              data={MUSCLE_GROUPS}
              renderItem={({ item }) => (
                <FilterChip
                  label={item}
                  selected={selectedFilter === item}
                  onPress={() => handleFilterPress(item)}
                />
              )}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersContainer}
            />
            <ThemedText style={[styles.exerciseCount, { color: theme.textSecondary }]}>
              {filteredExercises.length} exercises
              {customExercises.length > 0 ? ` (${customExercises.length} custom)` : ""}
            </ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerContainer: {
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  exerciseCount: {
    marginTop: Spacing.md,
    fontSize: 13,
    textAlign: "center",
  },
  row: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardWrapper: {
    flex: 1,
    maxWidth: "50%",
  },
  exerciseCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  exerciseIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
    marginBottom: Spacing.sm,
    minHeight: 40,
  },
  muscleTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  muscleTagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  equipmentText: {
    fontSize: 12,
  },
  customBadge: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  textInput: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  optionChipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  apiSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  apiSearchInput: {
    flex: 1,
    fontSize: 16,
  },
  apiSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  apiResultsList: {
    gap: Spacing.sm,
  },
  apiResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  apiResultInfo: {
    flex: 1,
  },
  apiResultName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 4,
  },
  apiResultMeta: {
    fontSize: 13,
  },
  progressModalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "90%",
  },
  progressSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md * 3) / 2,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  statLabel: {
    fontSize: 12,
  },
  prCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  prHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  prTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  prValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: 4,
  },
  prVolume: {
    fontSize: 14,
  },
  trendSection: {
    marginBottom: Spacing.xl,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  trendText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: Spacing.xs,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
  },
  barContainer: {
    width: "100%",
    height: 100,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: BorderRadius.xs,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  historySection: {
    gap: Spacing.sm,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  historyLeft: {
    gap: 2,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: "500",
  },
  historySets: {
    fontSize: 12,
  },
  historyVolume: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"] * 2,
    gap: Spacing.md,
  },
  noDataText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  noDataSubtext: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
