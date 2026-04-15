import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  WorkoutPlan,
  WorkoutDay,
  Exercise,
  getWorkoutPlans,
  saveWorkoutPlan,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "EditPlan">;

// ─── Exercise library (same source as ExercisesScreen) ───────────────────────
interface LibraryExercise {
  id: string;
  name: string;
  muscleGroup: string;
}

const EXERCISE_LIBRARY: LibraryExercise[] = [
  { id: "1",  name: "Bench Press",              muscleGroup: "Chest" },
  { id: "2",  name: "Incline Dumbbell Press",   muscleGroup: "Chest" },
  { id: "3",  name: "Decline Bench Press",      muscleGroup: "Chest" },
  { id: "4",  name: "Cable Flyes",              muscleGroup: "Chest" },
  { id: "5",  name: "Push-ups",                 muscleGroup: "Chest" },
  { id: "6",  name: "Dumbbell Flyes",           muscleGroup: "Chest" },
  { id: "7",  name: "Chest Dips",               muscleGroup: "Chest" },
  { id: "8",  name: "Machine Chest Press",      muscleGroup: "Chest" },
  { id: "9",  name: "Pec Deck",                 muscleGroup: "Chest" },
  { id: "10", name: "Landmine Press",           muscleGroup: "Chest" },
  { id: "11", name: "Squat",                    muscleGroup: "Legs" },
  { id: "12", name: "Front Squat",              muscleGroup: "Legs" },
  { id: "13", name: "Leg Press",                muscleGroup: "Legs" },
  { id: "14", name: "Lunges",                   muscleGroup: "Legs" },
  { id: "15", name: "Bulgarian Split Squat",    muscleGroup: "Legs" },
  { id: "16", name: "Leg Extension",            muscleGroup: "Legs" },
  { id: "17", name: "Leg Curl",                 muscleGroup: "Legs" },
  { id: "18", name: "Romanian Deadlift",        muscleGroup: "Legs" },
  { id: "19", name: "Goblet Squat",             muscleGroup: "Legs" },
  { id: "20", name: "Hack Squat",               muscleGroup: "Legs" },
  { id: "21", name: "Step-ups",                 muscleGroup: "Legs" },
  { id: "22", name: "Hip Thrust",               muscleGroup: "Legs" },
  { id: "23", name: "Calf Raises",              muscleGroup: "Legs" },
  { id: "24", name: "Seated Calf Raises",       muscleGroup: "Legs" },
  { id: "25", name: "Deadlift",                 muscleGroup: "Back" },
  { id: "26", name: "Sumo Deadlift",            muscleGroup: "Back" },
  { id: "27", name: "Barbell Rows",             muscleGroup: "Back" },
  { id: "28", name: "Pendlay Rows",             muscleGroup: "Back" },
  { id: "29", name: "Dumbbell Rows",            muscleGroup: "Back" },
  { id: "30", name: "Lat Pulldown",             muscleGroup: "Back" },
  { id: "31", name: "Pull-ups",                 muscleGroup: "Back" },
  { id: "32", name: "Chin-ups",                 muscleGroup: "Back" },
  { id: "33", name: "Seated Cable Row",         muscleGroup: "Back" },
  { id: "34", name: "T-Bar Row",                muscleGroup: "Back" },
  { id: "35", name: "Machine Row",              muscleGroup: "Back" },
  { id: "36", name: "Straight Arm Pulldown",    muscleGroup: "Back" },
  { id: "37", name: "Shrugs",                   muscleGroup: "Back" },
  { id: "38", name: "Hyperextensions",          muscleGroup: "Back" },
  { id: "39", name: "Overhead Press",           muscleGroup: "Shoulders" },
  { id: "40", name: "Dumbbell Shoulder Press",  muscleGroup: "Shoulders" },
  { id: "41", name: "Arnold Press",             muscleGroup: "Shoulders" },
  { id: "42", name: "Lateral Raises",           muscleGroup: "Shoulders" },
  { id: "43", name: "Cable Lateral Raises",     muscleGroup: "Shoulders" },
  { id: "44", name: "Front Raises",             muscleGroup: "Shoulders" },
  { id: "45", name: "Face Pulls",               muscleGroup: "Shoulders" },
  { id: "46", name: "Reverse Flyes",            muscleGroup: "Shoulders" },
  { id: "47", name: "Upright Rows",             muscleGroup: "Shoulders" },
  { id: "48", name: "Machine Shoulder Press",   muscleGroup: "Shoulders" },
  { id: "49", name: "Push Press",               muscleGroup: "Shoulders" },
  { id: "50", name: "Bicep Curls",              muscleGroup: "Arms" },
  { id: "51", name: "Barbell Curls",            muscleGroup: "Arms" },
  { id: "52", name: "Hammer Curls",             muscleGroup: "Arms" },
  { id: "53", name: "Preacher Curls",           muscleGroup: "Arms" },
  { id: "54", name: "Concentration Curls",      muscleGroup: "Arms" },
  { id: "55", name: "Cable Curls",              muscleGroup: "Arms" },
  { id: "56", name: "Incline Dumbbell Curls",   muscleGroup: "Arms" },
  { id: "57", name: "Spider Curls",             muscleGroup: "Arms" },
  { id: "58", name: "Tricep Pushdowns",         muscleGroup: "Arms" },
  { id: "59", name: "Skull Crushers",           muscleGroup: "Arms" },
  { id: "60", name: "Overhead Tricep Extension",muscleGroup: "Arms" },
  { id: "61", name: "Tricep Dips",              muscleGroup: "Arms" },
  { id: "62", name: "Close Grip Bench Press",   muscleGroup: "Arms" },
  { id: "63", name: "Diamond Push-ups",         muscleGroup: "Arms" },
  { id: "64", name: "Tricep Kickbacks",         muscleGroup: "Arms" },
  { id: "65", name: "Rope Pushdowns",           muscleGroup: "Arms" },
  { id: "66", name: "Wrist Curls",              muscleGroup: "Arms" },
  { id: "67", name: "Crunches",                 muscleGroup: "Core" },
  { id: "68", name: "Plank",                    muscleGroup: "Core" },
  { id: "69", name: "Russian Twists",           muscleGroup: "Core" },
  { id: "70", name: "Leg Raises",               muscleGroup: "Core" },
  { id: "71", name: "Hanging Leg Raises",       muscleGroup: "Core" },
  { id: "72", name: "Ab Wheel Rollout",         muscleGroup: "Core" },
  { id: "73", name: "Cable Crunches",           muscleGroup: "Core" },
  { id: "74", name: "Mountain Climbers",        muscleGroup: "Core" },
  { id: "75", name: "Dead Bug",                 muscleGroup: "Core" },
  { id: "76", name: "Bird Dog",                 muscleGroup: "Core" },
  { id: "77", name: "Side Plank",               muscleGroup: "Core" },
  { id: "78", name: "Bicycle Crunches",         muscleGroup: "Core" },
  { id: "79", name: "Kettlebell Swings",        muscleGroup: "Full Body" },
  { id: "80", name: "Clean and Press",          muscleGroup: "Full Body" },
  { id: "81", name: "Thrusters",                muscleGroup: "Full Body" },
  { id: "82", name: "Burpees",                  muscleGroup: "Full Body" },
  { id: "83", name: "Box Jumps",                muscleGroup: "Full Body" },
  { id: "84", name: "Battle Ropes",             muscleGroup: "Full Body" },
  { id: "85", name: "Farmers Walk",             muscleGroup: "Full Body" },
];

// ─── Add Exercise Modal ───────────────────────────────────────────────────────
function AddExerciseModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (ex: LibraryExercise) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? EXERCISE_LIBRARY.filter(
        (e) =>
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.muscleGroup.toLowerCase().includes(query.toLowerCase())
      )
    : EXERCISE_LIBRARY;

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.backgroundRoot }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.modalHeader,
            {
              borderBottomColor: theme.border,
              paddingTop: insets.top || Spacing.lg,
            },
          ]}
        >
          <ThemedText style={styles.modalTitle}>Add Exercise</ThemedText>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="button-close-add-exercise-modal"
          >
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Search */}
        <View
          style={[
            styles.searchRow,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search exercises…"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            testID="input-exercise-search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAdd(item);
                handleClose();
              }}
              style={({ pressed }) => [
                styles.libraryRow,
                {
                  backgroundColor: pressed
                    ? theme.backgroundSecondary
                    : theme.backgroundDefault,
                  borderBottomColor: theme.border,
                },
              ]}
              testID={`button-add-exercise-${item.id}`}
            >
              <View style={styles.libraryRowInfo}>
                <ThemedText style={styles.libraryName}>{item.name}</ThemedText>
                <ThemedText style={[styles.libraryMuscle, { color: theme.textSecondary }]}>
                  {item.muscleGroup}
                </ThemedText>
              </View>
              <Feather name="plus" size={20} color={Colors.light.primary} />
            </Pressable>
          )}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Exercise Row ─────────────────────────────────────────────────────────────
function ExerciseRow({
  exercise,
  index,
  total,
  activeIndex,
  onSetActive,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  activeIndex: number | null;
  onSetActive: (i: number | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const isActive = activeIndex === index;

  return (
    <View
      style={[
        styles.exerciseRow,
        {
          backgroundColor: isActive
            ? Colors.light.primary + "0D"
            : theme.backgroundDefault,
          borderColor: isActive ? Colors.light.primary + "40" : theme.border,
        },
      ]}
    >
      {/* Drag handle / move controls */}
      {isActive ? (
        <View style={styles.moveControls}>
          <Pressable
            onPress={() => { if (index > 0) { onMoveUp(); } }}
            hitSlop={6}
            style={{ opacity: index === 0 ? 0.3 : 1 }}
            testID={`button-move-up-${index}`}
          >
            <Feather name="chevron-up" size={20} color={Colors.light.primary} />
          </Pressable>
          <Pressable
            onPress={() => { if (index < total - 1) { onMoveDown(); } }}
            hitSlop={6}
            style={{ opacity: index === total - 1 ? 0.3 : 1 }}
            testID={`button-move-down-${index}`}
          >
            <Feather name="chevron-down" size={20} color={Colors.light.primary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSetActive(index);
          }}
          hitSlop={8}
          style={styles.dragHandle}
          testID={`button-drag-handle-${index}`}
        >
          <Feather name="menu" size={18} color={theme.textSecondary} />
        </Pressable>
      )}

      {/* Info */}
      <Pressable
        style={styles.exerciseInfo}
        onPress={() => isActive && onSetActive(null)}
      >
        <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
        <ThemedText style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
          {exercise.muscleGroup} · {exercise.sets} × {exercise.reps}
        </ThemedText>
      </Pressable>

      {/* Delete */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete();
        }}
        hitSlop={8}
        style={styles.deleteIcon}
        testID={`button-delete-exercise-${index}`}
      >
        <Feather name="trash-2" size={18} color={Colors.light.error} />
      </Pressable>
    </View>
  );
}

// ─── Day Section ──────────────────────────────────────────────────────────────
function DaySection({
  day,
  dayIndex,
  onExerciseDelete,
  onExerciseMoveUp,
  onExerciseMoveDown,
  onAddExercise,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onExerciseDelete: (exIndex: number) => void;
  onExerciseMoveUp: (exIndex: number) => void;
  onExerciseMoveDown: (exIndex: number) => void;
  onAddExercise: () => void;
}) {
  const { theme } = useTheme();
  const [activeExIndex, setActiveExIndex] = useState<number | null>(null);

  return (
    <Animated.View
      entering={FadeInDown.delay(dayIndex * 80).duration(300)}
      style={[styles.daySection, { backgroundColor: theme.backgroundRoot }]}
    >
      <View style={styles.dayHeader}>
        <View style={[styles.dayBadge, { backgroundColor: Colors.light.primary + "15" }]}>
          <ThemedText style={[styles.dayBadgeText, { color: Colors.light.primary }]}>
            Day {dayIndex + 1}
          </ThemedText>
        </View>
        <ThemedText style={styles.dayName}>{day.dayName}</ThemedText>
      </View>

      <View style={[styles.exerciseList, { borderColor: theme.border }]}>
        {day.exercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <ThemedText style={[styles.emptyDayText, { color: theme.textSecondary }]}>
              No exercises yet
            </ThemedText>
          </View>
        ) : (
          day.exercises.map((ex, exIdx) => (
            <ExerciseRow
              key={ex.id + exIdx}
              exercise={ex}
              index={exIdx}
              total={day.exercises.length}
              activeIndex={activeExIndex}
              onSetActive={(i) => setActiveExIndex(i)}
              onMoveUp={() => {
                onExerciseMoveUp(exIdx);
                setActiveExIndex(exIdx - 1);
              }}
              onMoveDown={() => {
                onExerciseMoveDown(exIdx);
                setActiveExIndex(exIdx + 1);
              }}
              onDelete={() => {
                setActiveExIndex(null);
                onExerciseDelete(exIdx);
              }}
            />
          ))
        )}
      </View>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setActiveExIndex(null);
          onAddExercise();
        }}
        style={[styles.addExerciseButton, { borderColor: Colors.light.primary }]}
        testID={`button-add-exercise-day-${dayIndex}`}
      >
        <Feather name="plus" size={16} color={Colors.light.primary} />
        <ThemedText style={[styles.addExerciseText, { color: Colors.light.primary }]}>
          Add Exercise
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function EditPlanScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [planName, setPlanName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state: which day index is open for "Add Exercise"
  const [addModalDayIndex, setAddModalDayIndex] = useState<number | null>(null);

  const loadPlan = useCallback(async () => {
    try {
      const plans = await getWorkoutPlans();
      const found = plans.find((p) => p.id === planId);
      if (found) {
        setPlan(JSON.parse(JSON.stringify(found))); // deep clone to avoid mutating stored ref
        setPlanName(found.name);
      }
    } catch (err) {
      console.error("EditPlanScreen: failed to load plan", err);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useFocusEffect(useCallback(() => { loadPlan(); }, [loadPlan]));

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!plan || !planName.trim()) return;
    setIsSaving(true);
    try {
      const updated: WorkoutPlan = {
        ...plan,
        name: planName.trim(),
        lastModified: new Date().toISOString(),
      };
      await saveWorkoutPlan(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err) {
      console.error("EditPlanScreen: failed to save plan", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Mutations (produce new plan state immutably) ──────────────────────────
  const mutateDays = (updater: (days: WorkoutDay[]) => WorkoutDay[]) => {
    setPlan((prev) => prev ? { ...prev, days: updater(prev.days) } : prev);
  };

  const deleteExercise = (dayIdx: number, exIdx: number) => {
    mutateDays((days) =>
      days.map((d, i) =>
        i !== dayIdx
          ? d
          : { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) }
      )
    );
  };

  const moveExercise = (dayIdx: number, exIdx: number, direction: -1 | 1) => {
    mutateDays((days) =>
      days.map((d, i) => {
        if (i !== dayIdx) return d;
        const exs = [...d.exercises];
        const target = exIdx + direction;
        if (target < 0 || target >= exs.length) return d;
        [exs[exIdx], exs[target]] = [exs[target], exs[exIdx]];
        return { ...d, exercises: exs };
      })
    );
  };

  const addExercise = (dayIdx: number, libEx: LibraryExercise) => {
    const newExercise: Exercise = {
      id: `${libEx.id}-${Date.now()}`,
      name: libEx.name,
      muscleGroup: libEx.muscleGroup,
      sets: 3,
      reps: "8-12",
    };
    mutateDays((days) =>
      days.map((d, i) =>
        i !== dayIdx ? d : { ...d, exercises: [...d.exercises, newExercise] }
      )
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>Plan not found</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["4xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Plan name */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.nameSection}>
          <ThemedText style={styles.sectionLabel}>Plan Name</ThemedText>
          <TextInput
            style={[
              styles.nameInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={planName}
            onChangeText={setPlanName}
            placeholder="Plan name"
            placeholderTextColor={theme.textSecondary}
            testID="input-edit-plan-name"
          />
        </Animated.View>

        {/* Days */}
        {plan.days.map((day, dayIdx) => (
          <DaySection
            key={dayIdx}
            day={day}
            dayIndex={dayIdx}
            onExerciseDelete={(exIdx) => deleteExercise(dayIdx, exIdx)}
            onExerciseMoveUp={(exIdx) => moveExercise(dayIdx, exIdx, -1)}
            onExerciseMoveDown={(exIdx) => moveExercise(dayIdx, exIdx, 1)}
            onAddExercise={() => setAddModalDayIndex(dayIdx)}
          />
        ))}

        {/* Save button */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !planName.trim()}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: Colors.light.primary,
                opacity: pressed || !planName.trim() ? 0.7 : 1,
              },
            ]}
            testID="button-save-plan"
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={18} color="#FFFFFF" />
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Add Exercise Modal */}
      <AddExerciseModal
        visible={addModalDayIndex !== null}
        onClose={() => setAddModalDayIndex(null)}
        onAdd={(libEx) => {
          if (addModalDayIndex !== null) {
            addExercise(addModalDayIndex, libEx);
          }
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg },

  nameSection: { marginBottom: Spacing["2xl"] },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  nameInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },

  // Day section
  daySection: { marginBottom: Spacing["2xl"] },
  dayHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  dayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.sm,
  },
  dayBadgeText: { fontSize: 12, fontWeight: "600" },
  dayName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },

  // Exercise list container
  exerciseList: { borderRadius: BorderRadius.md, overflow: "hidden", borderWidth: 1 },
  emptyDay: { padding: Spacing.lg, alignItems: "center" },
  emptyDayText: { fontSize: 14 },

  // Exercise row
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E8E8",
    minHeight: 60,
  },
  dragHandle: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  moveControls: {
    marginRight: Spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  exerciseInfo: { flex: 1, paddingRight: Spacing.sm },
  exerciseName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
  exerciseMeta: { fontSize: 13 },
  deleteIcon: { padding: Spacing.xs },

  // Add exercise button
  addExerciseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: Spacing.xs,
  },
  addExerciseText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },

  // Save button
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },

  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  libraryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
  },
  libraryRowInfo: { flex: 1 },
  libraryName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
  libraryMuscle: { fontSize: 13 },
});
