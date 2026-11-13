import React, { useEffect, useMemo, useState} from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { nativeRequest } from "@/lib/nativeApi";
import { toast } from "@/lib/toast";
import { translateMuscleGroup, isMobilityExercise, isHoldExercise } from "@/lib/exerciseTaxonomy";
import { ScreenGradient } from "@/components/surface/ScreenGradient";
import {
  addCustomExercise,
  loadCustomExercises,
  setMeasureOverride,
  type CustomExercise,
  type ExerciseMeasure,
} from "@/lib/customExercises";
import { ExerciseDbThumb } from "@/components/workout/ExerciseDbThumb";
import { getExerciseDisplayName } from "@/lib/exerciseDisplayName";
import type { CatalogRow } from "@/lib/importCatalog";
import { searchExercisesDetailed } from "@shared/exerciseSearch";

/** Muscle groups a user can file a self-defined exercise under. */
const CUSTOM_MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Core",
  "Full Body",
  "Mobility",
] as const;

/** A catalogue row; `measure` is set when the user just created it and chose one. */
export type PickerExercise = CatalogRow & { measure?: ExerciseMeasure };

interface ExercisePickerModalProps {
  visible: boolean;
  title: string;
  /** Exercise names already in this workout — filtered out of results. */
  excludeNames?: Set<string>;
  /** Pre-filter results to this muscle group (e.g. when swapping an exercise). */
  initialMuscleGroup?: string;
  /**
   * Stay open after a pick so several exercises can be added in one go (plan
   * building). Picked rows — and any in `selectedNames` — show a check.
   */
  keepOpenOnSelect?: boolean;
  /** Names to show as already added when `keepOpenOnSelect` is on. */
  selectedNames?: Set<string>;
  onClose: () => void;
  onSelect: (exercise: PickerExercise) => void;
}

export function ExercisePickerModal({
  visible,
  title,
  excludeNames,
  initialMuscleGroup,
  keepOpenOnSelect = false,
  selectedNames,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  // The cached catalog (works offline, opens instantly) rather than a fresh
  // fetch on every open, which came back empty without a connection.
  const { catalog: cachedCatalog, loading: catalogLoading } = useExerciseCatalog();
  // The user's own exercises first, so one made last week is found again —
  // the server keeps them but never lists them back in the catalogue.
  const [customs, setCustoms] = useState<CustomExercise[]>([]);
  useEffect(() => {
    if (visible) void loadCustomExercises().then(setCustoms);
  }, [visible]);
  const catalog = useMemo<CatalogRow[]>(() => {
    const customNames = new Set(customs.map((c) => c.name.toLowerCase()));
    // A-Z by the name on screen, as in the Exercises tab.
    const collator = new Intl.Collator(i18n.language, { sensitivity: "base" });
    const label = (c: { name: string; nameDe?: string | null }) =>
      getExerciseDisplayName(c, i18n.language);
    return [
      ...customs.map((c, i) => ({
        id: -(i + 1),
        name: c.name,
        name_de: c.nameDe ?? null,
        muscle_group: c.muscleGroup,
        equipment: (c.equipment || "other").toLowerCase(),
      })),
      ...cachedCatalog
        .filter((c) => !customNames.has(c.name.toLowerCase()))
        .sort((a, b) => collator.compare(label(a), label(b)))
        .map((c) => ({
          id: Number(c.id),
          name: c.name,
          name_de: c.nameDe ?? null,
          muscle_group: c.muscleGroup,
          equipment: c.equipment.toLowerCase(),
        })),
    ];
  }, [cachedCatalog, customs, i18n.language]);
  const loading = catalogLoading && catalog.length === 0;
  const [mobilityOnly, setMobilityOnly] = useState(false);
  // Active muscle-group filter — seeded from initialMuscleGroup on open so a
  // swap lands straight on same-muscle alternatives; user can clear it.
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setMuscleFilter(initialMuscleGroup ?? null);
      setAddedNames(new Set());
    }
  }, [visible, initialMuscleGroup]);
  /** Name pending a muscle-group choice before it's created as a custom exercise. */
  const [pendingCustomName, setPendingCustomName] = useState<string | null>(null);
  /** Weight × reps or seconds for the exercise being created; guessed from its name. */
  const [customMeasure, setCustomMeasure] = useState<ExerciseMeasure>("weight");
  const [creating, setCreating] = useState(false);

  // Older plans file exercises under coarse groups ("Legs", "Arms") the
  // catalog doesn't use ("Quads", "Biceps"…). Seeding the filter with one of
  // those would show an empty list, so only apply a group the catalog has.
  const activeMuscleFilter = useMemo(
    () =>
      muscleFilter && catalog.some((e) => e.muscle_group === muscleFilter)
        ? muscleFilter
        : null,
    [muscleFilter, catalog],
  );

  const isAdded = (name: string) =>
    addedNames.has(name) || (selectedNames?.has(name) ?? false);

  const pick = (exercise: CatalogRow) => {
    onSelect(exercise);
    if (keepOpenOnSelect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedNames((prev) => new Set(prev).add(exercise.name));
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      handleClose();
    }
  };

  const { items: results, partial: partialResults } = useMemo(() => {
    const filtered = catalog.filter((e) => {
      if (excludeNames?.has(e.name)) return false;
      if (mobilityOnly && !isMobilityExercise(e.name)) return false;
      if (activeMuscleFilter && e.muscle_group !== activeMuscleFilter) return false;
      return true;
    });
    // Word by word, in any order, with plurals, typos, abbreviations ("kh")
    // and the other language forgiven: "curls dum" finds "Dumbbell Curl".
    // Names (English or German) outrank equipment/muscle-only matches.
    return searchExercisesDetailed(
      filtered,
      query,
      (e) => [e.name, e.name_de],
      (e) => [e.muscle_group, e.equipment],
    );
  }, [catalog, query, excludeNames, mobilityOnly, activeMuscleFilter]);

  const trimmedQuery = query.trim();
  // Offer "create custom" only when the search text isn't already an exact
  // catalog name (case-insensitive) — no point creating a duplicate.
  const hasExactMatch = useMemo(
    () =>
      catalog.some(
        (e) =>
          e.name.toLowerCase() === trimmedQuery.toLowerCase() ||
          e.name_de?.toLowerCase() === trimmedQuery.toLowerCase(),
      ),
    [catalog, trimmedQuery],
  );
  const canOfferCustom = trimmedQuery.length >= 2 && !hasExactMatch;

  const handleClose = () => {
    setQuery("");
    setMobilityOnly(false);
    setMuscleFilter(null);
    setPendingCustomName(null);
    setCreating(false);
    onClose();
  };

  const createCustomExercise = async (muscleGroup: string) => {
    const name = pendingCustomName?.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      // Kept locally first, so it can be found, renamed and measured in
      // seconds without a connection; the server copy is best effort.
      await addCustomExercise({ name, muscleGroup, equipment: "other" });
      await setMeasureOverride(name, customMeasure);
      const serverId = await nativeRequest<{ id: number }>("/api/exercises", {
        method: "POST",
        body: JSON.stringify({ name, muscle_group: muscleGroup }),
      })
        .then((r) => r.id)
        .catch(() => -Date.now());
      const row: PickerExercise = {
        id: serverId,
        name,
        name_de: null,
        muscle_group: muscleGroup,
        equipment: "other",
        measure: customMeasure,
      };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect(row);
      if (keepOpenOnSelect) {
        setAddedNames((prev) => new Set(prev).add(row.name));
        setPendingCustomName(null);
        setCreating(false);
        setQuery("");
      } else {
        handleClose();
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(t("activeWorkout.picker.createFailed"));
      setCreating(false);
    }
  };

  const createCustomRow = canOfferCustom ? (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCustomMeasure(isHoldExercise(trimmedQuery) ? "time" : "weight");
        setPendingCustomName(trimmedQuery);
      }}
      style={({ pressed }) => [
        styles.createRow,
        { borderColor: theme.primary },
        pressed && { backgroundColor: theme.primary + "10" },
      ]}
      testID="row-create-custom-exercise"
    >
      <Feather name="plus-circle" size={18} color={theme.primary} />
      <ThemedText style={[styles.createRowText, { color: theme.primary }]} numberOfLines={2}>
        {t("activeWorkout.picker.createCustom", { name: trimmedQuery })}
      </ThemedText>
    </Pressable>
  ) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: theme.groundBottom }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenGradient />
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: theme.hairline, paddingTop: insets.top || Spacing.lg },
          ]}
        >
          <ThemedText style={styles.modalTitle}>{title}</ThemedText>
          {keepOpenOnSelect ? (
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              testID="button-close-exercise-picker"
            >
              <ThemedText style={[styles.doneButtonText, { color: theme.onChalk }]}>
                {t("activeWorkout.picker.done")}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="button-close-exercise-picker"
            >
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          )}
        </View>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: theme.well, borderColor: theme.hairline },
          ]}
        >
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            returnKeyType="search"
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={t("activeWorkout.picker.searchPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            testID="input-exercise-picker-search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        <View style={styles.filterRow}>
          {activeMuscleFilter ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMuscleFilter(null);
              }}
              // Same chips as the Exercises tab: chalk when on, no per-muscle colours.
              style={[styles.filterChip, { backgroundColor: theme.primary }]}
              testID="chip-picker-muscle"
            >
              <ThemedText style={[styles.filterChipText, { color: theme.onChalk }]}>
                {translateMuscleGroup(t, activeMuscleFilter)}
              </ThemedText>
              <Feather name="x" size={13} color={theme.onChalk} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMobilityOnly((v) => !v);
            }}
            style={[
              styles.filterChip,
              { backgroundColor: mobilityOnly ? theme.primary : theme.chipIdle },
            ]}
            testID="chip-picker-mobility"
          >
            <Feather name="wind" size={13} color={mobilityOnly ? theme.onChalk : theme.text} />
            <ThemedText
              style={[styles.filterChipText, { color: mobilityOnly ? theme.onChalk : theme.text }]}
            >
              {translateMuscleGroup(t, "Mobility")}
            </ThemedText>
          </Pressable>
        </View>

        {pendingCustomName !== null ? (
          <View style={styles.customPanel}>
            <ThemedText style={[styles.customPanelLabel, { color: theme.textSecondary }]}>
              {t("activeWorkout.picker.newCustom")}
            </ThemedText>
            <ThemedText style={styles.customPanelName} numberOfLines={2}>
              {pendingCustomName}
            </ThemedText>
            {creating ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.xl }} />
            ) : (
              <>
                <ThemedText style={[styles.customPanelLabel, { color: theme.textSecondary }]}>
                  {t("activeWorkout.picker.measureLabel")}
                </ThemedText>
                <View style={styles.measureRow}>
                  {(["weight", "time"] as const).map((m) => {
                    const on = customMeasure === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomMeasure(m);
                        }}
                        style={[
                          styles.measureOption,
                          on
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { borderColor: theme.controlOutline },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        testID={`option-custom-measure-${m}`}
                      >
                        <Feather name={m === "time" ? "clock" : "hash"} size={14} color={on ? theme.onChalk : theme.text} />
                        <ThemedText style={[styles.measureOptionText, { color: on ? theme.onChalk : theme.text }]}>
                          {t(m === "time" ? "activeWorkout.picker.measureTime" : "activeWorkout.picker.measureWeight")}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Picking the muscle group is the last step and creates it. */}
                <ThemedText style={[styles.customPanelLabel, styles.customStepLabel, { color: theme.textSecondary }]}>
                  {t("activeWorkout.picker.chooseMuscleGroup")}
                </ThemedText>
                <View style={styles.muscleGrid}>
                  {CUSTOM_MUSCLE_GROUPS.map((mg) => (
                    <Pressable
                      key={mg}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void createCustomExercise(mg);
                      }}
                      style={({ pressed }) => [
                        styles.muscleOption,
                        { backgroundColor: pressed ? theme.controlOutline : theme.chipIdle },
                      ]}
                      testID={`option-custom-muscle-${mg}`}
                    >
                      <ThemedText style={[styles.muscleOptionText, { color: theme.text }]}>
                        {translateMuscleGroup(t, mg)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setPendingCustomName(null)}
                  style={styles.customCancel}
                  hitSlop={8}
                >
                  <Feather name="chevron-left" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.customCancelText, { color: theme.textSecondary }]}>
                    {t("common.back")}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        ) : loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : (
          <FlatList
            keyboardDismissMode="on-drag"
            data={results}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (keepOpenOnSelect && isAdded(item.name)) {
                    Haptics.selectionAsync();
                    return;
                  }
                  pick(item);
                }}
                accessibilityState={
                  keepOpenOnSelect ? { selected: isAdded(item.name) } : undefined
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.hairline },
                  pressed && { backgroundColor: theme.chipIdle },
                ]}
                testID={`row-picker-exercise-${item.id}`}
              >
                <ExerciseDbThumb
                  exerciseName={item.name}
                  style={styles.rowThumb}
                  testID={`thumb-picker-exercise-${item.id}`}
                />
                <View style={styles.rowInfo}>
                  <ThemedText style={styles.rowName} numberOfLines={1}>
                    {getExerciseDisplayName(
                      { name: item.name, nameDe: item.name_de },
                      i18n.language,
                    )}
                  </ThemedText>
                  <View style={[styles.muscleTag, { backgroundColor: theme.chipIdle }]}>
                    <ThemedText style={[styles.muscleTagText, { color: theme.textSecondary }]}>
                      {translateMuscleGroup(t, item.muscle_group)}
                    </ThemedText>
                  </View>
                </View>
                {!keepOpenOnSelect ? (
                  <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                ) : isAdded(item.name) ? (
                  <View style={styles.addedBadge}>
                    <Feather name="check" size={14} color={theme.primary} />
                    <ThemedText style={[styles.addedText, { color: theme.primary }]}>
                      {t("activeWorkout.picker.added")}
                    </ThemedText>
                  </View>
                ) : (
                  <Feather name="plus-circle" size={22} color={theme.primary} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  {t("activeWorkout.picker.noResults")}
                </ThemedText>
              </View>
            }
            // Nothing matches every typed word: the user is most likely after
            // an exercise the catalogue doesn't have ("hyperextension hold"),
            // so creating it comes first instead of below the near-misses.
            ListHeaderComponent={partialResults ? createCustomRow : null}
            ListFooterComponent={partialResults ? null : createCustomRow}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  doneButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  addedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addedText: {
    fontSize: 12,
    fontWeight: "700",
  },
  measureRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  customStepLabel: {
    marginTop: Spacing.xl,
  },
  measureOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  measureOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: c.iron,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
  },
  muscleTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  muscleTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  createRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  customPanel: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  customPanelLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  customPanelName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  muscleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  muscleOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  muscleOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },
  customCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xl,
    alignSelf: "flex-start",
    paddingVertical: Spacing.sm,
  },
  customCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
