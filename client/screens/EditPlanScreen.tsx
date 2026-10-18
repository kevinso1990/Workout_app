import React, { useEffect, useMemo, useRef, useState} from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useNavigation,
  useRoute,
  usePreventRemove,
  type NavigationAction,
} from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";

import { useLocalizeExerciseName } from "@/hooks/useLocalizeExerciseName";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, FontFamily } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { HEVY } from "@/constants/hevyLayout";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import {
  translateMuscleGroup,
  isHoldExercise,
  isMobilityExercise,
} from "@/lib/exerciseTaxonomy";
import {
  WorkoutPlan,
  WorkoutDay,
  Exercise,
  getWorkoutPlans,
  saveWorkoutPlan,
} from "@/lib/storage";
import { scheduleDataSync } from "@/lib/dataSync";
import { translateDayName } from "@/lib/dayNameLabel";
import { displayPlanName } from "@/lib/defaultPlanName";
import { confirmAlert } from "@/lib/confirmAlert";
import {
  ExercisePickerModal,
  type PickerExercise,
} from "@/components/workout/ExercisePickerModal";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const MIN_SETS = 1;
const MAX_SETS = 10;

type Props = NativeStackScreenProps<RootStackParamList, "EditPlan">;

type ReplaceTarget = { dayIndex: number; exIndex: number; exercise: Exercise };

function snapshotOf(name: string, days: WorkoutDay[]): string {
  return JSON.stringify({ name, days });
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
  onReplace,
  onSetsChange,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  activeIndex: number | null;
  onSetActive: (i: number | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onReplace: () => void;
  onSetsChange: (delta: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const localizeName = useLocalizeExerciseName();
  const isActive = activeIndex === index;
  const canDecrement = exercise.sets > MIN_SETS;
  const canIncrement = exercise.sets < MAX_SETS;

  return (
    <View
      style={[
        styles.exerciseRow,
        {
          backgroundColor: isActive ? theme.primary + "0D" : theme.backgroundDefault,
          borderColor: isActive ? theme.primary + "40" : theme.border,
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
            <Feather name="chevron-up" size={20} color={theme.primary} />
          </Pressable>
          <Pressable
            onPress={() => { if (index < total - 1) { onMoveDown(); } }}
            hitSlop={6}
            style={{ opacity: index === total - 1 ? 0.3 : 1 }}
            testID={`button-move-down-${index}`}
          >
            <Feather name="chevron-down" size={20} color={theme.primary} />
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

      {/* Info + sets stepper */}
      <View style={styles.exerciseInfo}>
        <Pressable onPress={() => isActive && onSetActive(null)}>
          <ThemedText numberOfLines={2} style={styles.exerciseName}>
            {localizeName(exercise.name)}
          </ThemedText>
          <ThemedText style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
            {translateMuscleGroup(t, exercise.muscleGroup)} · {t("exercises.setsReps", { sets: exercise.sets, reps: exercise.reps })}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.setsStepper}>
          <Pressable
            onPress={() => {
              if (canDecrement) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSetsChange(-1);
              }
            }}
            hitSlop={8}
            disabled={!canDecrement}
            style={[
              styles.stepperBtn,
              { borderColor: theme.border, opacity: canDecrement ? 1 : 0.4 },
            ]}
            testID={`button-sets-decrement-${index}`}
          >
            <Feather name="minus" size={16} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.setsValue, { color: theme.text }]}>
            {exercise.sets}
          </ThemedText>
          <Pressable
            onPress={() => {
              if (canIncrement) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSetsChange(1);
              }
            }}
            hitSlop={8}
            disabled={!canIncrement}
            style={[
              styles.stepperBtn,
              { borderColor: theme.border, opacity: canIncrement ? 1 : 0.4 },
            ]}
            testID={`button-sets-increment-${index}`}
          >
            <Feather name="plus" size={16} color={theme.text} />
          </Pressable>
        </View>

      {/* Replace */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onReplace();
        }}
        hitSlop={8}
        style={styles.actionIcon}
        testID={`button-replace-exercise-${index}`}
      >
        <Feather name="repeat" size={17} color={theme.primary} />
      </Pressable>

      {/* Delete */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onDelete();
        }}
        hitSlop={8}
        style={styles.actionIcon}
        testID={`button-delete-exercise-${index}`}
      >
        <Feather name="trash-2" size={17} color={theme.error} />
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
  onReplaceExercise,
  onExerciseSetsChange,
  onRemoveDay,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onExerciseDelete: (exIndex: number) => void;
  onExerciseMoveUp: (exIndex: number) => void;
  onExerciseMoveDown: (exIndex: number) => void;
  onAddExercise: () => void;
  onReplaceExercise: (exIndex: number) => void;
  onExerciseSetsChange: (exIndex: number, delta: number) => void;
  /** Omitted for the last remaining day — a plan always keeps one. */
  onRemoveDay?: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [activeExIndex, setActiveExIndex] = useState<number | null>(null);
  const badge = t("editPlan.day", { n: dayIndex + 1 });
  const label = translateDayName(t, day.dayName);

  return (
    <Animated.View
      entering={FadeInDown.delay(dayIndex * 80).duration(300)}
      style={[styles.daySection, { backgroundColor: theme.backgroundRoot }]}
    >
      <View style={styles.dayHeader}>
        <View style={[styles.dayBadge, { backgroundColor: theme.primary + "15" }]}>
          <ThemedText style={[styles.dayBadgeText, { color: theme.primary }]}>
            {badge}
          </ThemedText>
        </View>
        {/* Manually built days are named "Tag 1"… — the same as the badge —
            so showing both read "TAG 1  Tag 1". */}
        <ThemedText style={[styles.dayName, { flex: 1 }]} numberOfLines={1}>
          {label.toLowerCase() === badge.toLowerCase() ? "" : label}
        </ThemedText>
        {onRemoveDay ? (
          <Pressable
            onPress={onRemoveDay}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("editPlan.removeDay")}
            testID={`button-remove-day-${dayIndex}`}
          >
            <Feather name="trash-2" size={17} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.exerciseList, { borderColor: theme.border }]}>
        {day.exercises.length === 0 ? (
          <View style={styles.emptyDay}>
            <ThemedText style={[styles.emptyDayText, { color: theme.textSecondary }]}>
              {t("editPlan.noExercisesYet")}
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
              onReplace={() => {
                setActiveExIndex(null);
                onReplaceExercise(exIdx);
              }}
              onSetsChange={(delta) => onExerciseSetsChange(exIdx, delta)}
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
        style={[styles.addExerciseButton, { borderColor: theme.primary }]}
        testID={`button-add-exercise-day-${dayIndex}`}
      >
        <Feather name="plus" size={16} color={theme.primary} />
        <ThemedText style={[styles.addExerciseText, { color: theme.primary }]}>
          {t("editPlan.addExercise")}
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
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [planName, setPlanName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [addModalDayIndex, setAddModalDayIndex] = useState<number | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ReplaceTarget | null>(null);

  /** Serialized plan as last loaded/saved — compared against to detect edits. */
  const savedSnapshotRef = useRef<string | null>(null);
  /**
   * A deliberate exit (after save → "back", after "discard" → the blocked
   * action). Stored as state, not a ref: it has to lift the usePreventRemove
   * guard in a render *before* navigating, or the guard blocks the exit too
   * and the screen gets stuck.
   */
  const [exitAction, setExitAction] = useState<NavigationAction | "back" | null>(null);

  // Loaded once, not on every focus: reloading on focus silently replaced any
  // unsaved edits with the stored plan whenever the screen regained focus.
  useEffect(() => {
    (async () => {
      try {
        const plans = await getWorkoutPlans();
        const found = plans.find((p) => p.id === planId);
        if (found) {
          const shownName = displayPlanName(t, found.name);
          setPlan(JSON.parse(JSON.stringify(found)));
          setPlanName(shownName);
          // Snapshot the *shown* name, so a legacy English default that is
          // only displayed localised doesn't count as an unsaved edit.
          savedSnapshotRef.current = snapshotOf(shownName, found.days);
        }
      } catch (err) {
        console.error("EditPlanScreen: failed to load plan", err);
      } finally {
        setIsLoading(false);
      }
    })();
    // Load once per plan — `t` only changes on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const isDirty =
    plan != null && snapshotOf(planName.trim(), plan.days) !== savedSnapshotRef.current;

  // Names already in the day being replaced (for filtering suggestions)
  const existingNamesInReplacedDay = useMemo<Set<string>>(() => {
    if (!replaceTarget || !plan) return new Set();
    const day = plan.days[replaceTarget.dayIndex];
    return new Set(day?.exercises.map((e) => e.name) ?? []);
  }, [replaceTarget, plan]);

  const namesInAddDay = useMemo<Set<string>>(() => {
    if (addModalDayIndex === null || !plan) return new Set();
    return new Set(plan.days[addModalDayIndex]?.exercises.map((e) => e.name) ?? []);
  }, [addModalDayIndex, plan]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!plan || !planName.trim()) return;
    setIsSaving(true);
    try {
      const updated: WorkoutPlan = {
        ...plan,
        name: planName.trim(),
        daysPerWeek: plan.days.length,
        lastModified: new Date().toISOString(),
      };
      await saveWorkoutPlan(updated);
      scheduleDataSync();
      savedSnapshotRef.current = snapshotOf(updated.name, updated.days);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExitAction("back");
    } catch (err) {
      console.error("EditPlanScreen: failed to save plan", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Stay on screen (edits preserved) and tell the user it didn't save —
      // silently swallowing this looked like a successful save with lost edits.
      toast.error(t("common.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  // Edits only persist on "Speichern" — swiping or tapping back used to throw
  // every added exercise away without a word. Ask first. usePreventRemove
  // (not a bare beforeRemove listener) because on the native stack only it
  // also holds back the header back button and the swipe gesture — a plain
  // listener fired after the screen was already gone natively.
  usePreventRemove(isDirty && exitAction === null, ({ data }) => {
    const leave = () => setExitAction(data.action);
    if (Platform.OS === "web") {
      // RN-web's Alert has no multi-button support — without this the
      // screen could never be left on web.
      if (window.confirm(`${t("editPlan.unsavedTitle")}\n\n${t("editPlan.unsavedMessage")}`)) {
        leave();
      }
      return;
    }
    Alert.alert(t("editPlan.unsavedTitle"), t("editPlan.unsavedMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("editPlan.unsavedDiscard"), style: "destructive", onPress: leave },
      { text: t("editPlan.unsavedSave"), onPress: () => void handleSaveRef.current() },
    ]);
  });

  useEffect(() => {
    if (exitAction === null) return;
    if (exitAction === "back") navigation.goBack();
    else navigation.dispatch(exitAction);
  }, [exitAction, navigation]);

  // ── Days ──────────────────────────────────────────────────────────────────
  const addDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            days: [
              ...prev.days,
              { dayName: t("createPlan.dayLabel", { count: prev.days.length + 1 }), exercises: [] },
            ],
            daysPerWeek: prev.days.length + 1,
          }
        : prev,
    );
  };

  const removeDay = async (dayIdx: number) => {
    if (!plan) return;
    const day = plan.days[dayIdx];
    if (day.exercises.length > 0) {
      const ok = await confirmAlert(
        t("editPlan.removeDayTitle", { name: translateDayName(t, day.dayName) }),
        t("editPlan.removeDayMessage", { count: day.exercises.length }),
        { confirmText: t("editPlan.removeDay"), cancelText: t("common.cancel"), destructive: true },
      );
      if (!ok) return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlan((prev) => {
      if (!prev) return prev;
      const days = prev.days
        .filter((_, i) => i !== dayIdx)
        // Keep auto-named days ("Tag 3") in step with their new position, or
        // removing Tag 2 would leave a day badged "Tag 2" but named "Tag 3".
        .map((d, i) => {
          const oldIndex = i >= dayIdx ? i + 1 : i;
          return d.dayName === t("createPlan.dayLabel", { count: oldIndex + 1 })
            ? { ...d, dayName: t("createPlan.dayLabel", { count: i + 1 }) }
            : d;
        });
      return { ...prev, days, daysPerWeek: days.length };
    });
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const mutateDays = (updater: (days: WorkoutDay[]) => WorkoutDay[]) => {
    setPlan((prev) => prev ? { ...prev, days: updater(prev.days) } : prev);
  };

  const deleteExercise = (dayIdx: number, exIdx: number) => {
    mutateDays((days) =>
      days.map((d, i) =>
        i !== dayIdx ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) }
      )
    );
  };

  const changeSets = (dayIdx: number, exIdx: number, delta: number) => {
    mutateDays((days) =>
      days.map((d, i) => {
        if (i !== dayIdx) return d;
        const exs = d.exercises.map((ex, j) => {
          if (j !== exIdx) return ex;
          const next = Math.max(MIN_SETS, Math.min(MAX_SETS, ex.sets + delta));
          return { ...ex, sets: next };
        });
        return { ...d, exercises: exs };
      })
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

  const addExercise = (dayIdx: number, picked: PickerExercise) => {
    // Holds (planks, stretches) are logged in seconds, so give them a seconds
    // target instead of "8-12" reps.
    const hold = isHoldExercise(picked.name);
    const newExercise: Exercise = {
      id: `${picked.id}-${Date.now()}`,
      name: picked.name,
      muscleGroup: picked.muscle_group,
      sets: hold && isMobilityExercise(picked.name) ? 2 : 3,
      reps: hold ? "30-45s" : "8-12",
      equipment: picked.equipment || null,
    };
    mutateDays((days) =>
      days.map((d, i) =>
        i !== dayIdx ? d : { ...d, exercises: [...d.exercises, newExercise] }
      )
    );
  };

  const replaceExercise = (dayIdx: number, exIdx: number, picked: PickerExercise) => {
    mutateDays((days) =>
      days.map((d, i) => {
        if (i !== dayIdx) return d;
        const exs = d.exercises.map((ex, j) => {
          if (j !== exIdx) return ex;
          return {
            id: `${picked.id}-${Date.now()}`,
            name: picked.name,
            muscleGroup: picked.muscle_group,
            sets: ex.sets,
            reps: ex.reps,
            equipment: picked.equipment || null,
          };
        });
        return { ...d, exercises: exs };
      })
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText>{t("plans.planNotFound")}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl),
            paddingBottom: insets.bottom + Spacing["4xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Plan name */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.nameSection}>
          <ThemedText style={styles.sectionLabel}>{t("editPlan.planName")}</ThemedText>
          <TextInput
            returnKeyType="done"
            clearButtonMode="while-editing"
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
            placeholder={t("importWorkout.review.planName")}
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
            onReplaceExercise={(exIdx) =>
              setReplaceTarget({ dayIndex: dayIdx, exIndex: exIdx, exercise: plan.days[dayIdx].exercises[exIdx] })
            }
            onExerciseSetsChange={(exIdx, delta) => changeSets(dayIdx, exIdx, delta)}
            onRemoveDay={plan.days.length > 1 ? () => void removeDay(dayIdx) : undefined}
          />
        ))}

        <Pressable
          onPress={addDay}
          style={[styles.addDayButton, { borderColor: theme.controlOutline }]}
          testID="button-add-day"
        >
          <Feather name="plus" size={16} color={theme.text} />
          <ThemedText style={[styles.addDayText, { color: theme.text }]}>
            {t("editPlan.addDay")}
          </ThemedText>
        </Pressable>

        {/* Save button */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !planName.trim()}
            style={({ pressed }) => [
              styles.saveButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed || !planName.trim() ? 0.7 : 1,
              },
            ]}
            testID="button-save-plan"
          >
            {isSaving ? (
              <ActivityIndicator color={theme.onChalk} />
            ) : (
              <>
                <Feather name="check" size={18} color={theme.onChalk} />
                <ThemedText style={styles.saveButtonText}>{t("editPlan.saveChanges")}</ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* One shared picker for add (stays open, several at once) and replace
          (single pick, pre-filtered to the replaced exercise's muscle group). */}
      <ExercisePickerModal
        visible={addModalDayIndex !== null || replaceTarget !== null}
        title={t(replaceTarget ? "editPlan.replaceTitle" : "editPlan.addExerciseTitle")}
        keepOpenOnSelect={addModalDayIndex !== null}
        selectedNames={namesInAddDay}
        initialMuscleGroup={replaceTarget?.exercise.muscleGroup}
        excludeNames={replaceTarget ? existingNamesInReplacedDay : undefined}
        onClose={() => {
          setAddModalDayIndex(null);
          setReplaceTarget(null);
        }}
        onSelect={(picked) => {
          if (replaceTarget) {
            replaceExercise(replaceTarget.dayIndex, replaceTarget.exIndex, picked);
          } else if (addModalDayIndex !== null) {
            addExercise(addModalDayIndex, picked);
          }
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg },

  nameSection: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: FontFamily.displaySemi,
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

  daySection: { marginBottom: Spacing["2xl"] },
  dayHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  dayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.sm,
  },
  dayBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  dayName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: FontFamily.displaySemi,
  },

  exerciseList: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    // Fill alone was not enough separation from the near-black page: one step
    // of the iron ramp is a small luminance jump. A defined edge reads as more
    // contrast than extra brightness would, and leaves the top of the ramp free
    // for the controls that sit ON this card.
    backgroundColor: c.ironElevated2,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  emptyDay: { padding: Spacing.lg, alignItems: "center" },
  emptyDayText: { fontSize: 14 },

  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // Was #E8E8E8 — a near-white light-theme hairline drawing a bright line
    // across every row on a dark screen.
    borderBottomColor: c.hairline,
    minHeight: 56,
  },
  dragHandle: { padding: Spacing.xs, marginRight: Spacing.sm },
  moveControls: { marginRight: Spacing.sm, alignItems: "center", gap: 2 },
  exerciseInfo: { flex: 1, paddingRight: Spacing.xs },
  exerciseName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
  exerciseMeta: { fontSize: 13 },
  actionIcon: { padding: Spacing.xs, marginLeft: 2 },

  setsStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: Spacing.xs,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.ironElevated3,
  },
  setsValue: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: FontFamily.mono,
    minWidth: 20,
    textAlign: "center",
  },

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
    fontFamily: FontFamily.displaySemi,
  },
  addDayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  addDayText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: FontFamily.displaySemi,
  },

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
    color: c.onChalk,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: FontFamily.displaySemi,
  },

});
