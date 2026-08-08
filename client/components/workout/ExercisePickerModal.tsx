import React, { useEffect, useMemo, useState } from "react";
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
import { getApiUrl } from "@/lib/query-client";
import { nativeRequest } from "@/lib/nativeApi";
import { toast } from "@/lib/toast";
import { translateMuscleGroup, getMuscleGroupColor, isMobilityExercise } from "@/lib/exerciseTaxonomy";
import { getExerciseDisplayName } from "@/lib/exerciseDisplayName";
import type { CatalogRow } from "@/lib/importCatalog";

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

export type PickerExercise = CatalogRow;

interface ExercisePickerModalProps {
  visible: boolean;
  title: string;
  /** Exercise names already in this workout — filtered out of results. */
  excludeNames?: Set<string>;
  /** Pre-filter results to this muscle group (e.g. when swapping an exercise). */
  initialMuscleGroup?: string;
  onClose: () => void;
  onSelect: (exercise: PickerExercise) => void;
}

export function ExercisePickerModal({
  visible,
  title,
  excludeNames,
  initialMuscleGroup,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobilityOnly, setMobilityOnly] = useState(false);
  // Active muscle-group filter — seeded from initialMuscleGroup on open so a
  // swap lands straight on same-muscle alternatives; user can clear it.
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setMuscleFilter(initialMuscleGroup ?? null);
  }, [visible, initialMuscleGroup]);
  /** Name pending a muscle-group choice before it's created as a custom exercise. */
  const [pendingCustomName, setPendingCustomName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible || catalog.length > 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = new URL("/api/exercises/catalog", getApiUrl()).toString();
        const res = await fetch(url);
        if (!res.ok) throw new Error("catalog fetch failed");
        const rows = (await res.json()) as CatalogRow[];
        if (!cancelled) setCatalog(rows);
      } catch {
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, catalog.length]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => {
      if (excludeNames?.has(e.name)) return false;
      if (mobilityOnly && !isMobilityExercise(e.name)) return false;
      if (muscleFilter && e.muscle_group !== muscleFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        // Match the German label too, so a German user can type "Bankdrücken".
        (e.name_de?.toLowerCase().includes(q) ?? false) ||
        e.muscle_group.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, excludeNames, mobilityOnly, muscleFilter]);

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
      const created = await nativeRequest<{
        id: number;
        name: string;
        muscle_group: string;
        equipment?: string;
      }>("/api/exercises", {
        method: "POST",
        body: JSON.stringify({ name, muscle_group: muscleGroup }),
      });
      const row: CatalogRow = {
        id: created.id,
        name: created.name,
        name_de: null,
        muscle_group: created.muscle_group,
        equipment: created.equipment ?? "barbell",
      };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSelect(row);
      handleClose();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(t("activeWorkout.picker.createFailed"));
      setCreating(false);
    }
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
        <View
          style={[
            styles.modalHeader,
            { borderBottomColor: theme.border, paddingTop: insets.top || Spacing.lg },
          ]}
        >
          <ThemedText style={styles.modalTitle}>{title}</ThemedText>
          <Pressable
            onPress={handleClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID="button-close-exercise-picker"
          >
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
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
          {muscleFilter ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMuscleFilter(null);
              }}
              style={[
                styles.filterChip,
                {
                  borderColor: getMuscleGroupColor(muscleFilter),
                  backgroundColor: getMuscleGroupColor(muscleFilter) + "1A",
                },
              ]}
              testID="chip-picker-muscle"
            >
              <ThemedText
                style={[styles.filterChipText, { color: getMuscleGroupColor(muscleFilter) }]}
              >
                {translateMuscleGroup(t, muscleFilter)}
              </ThemedText>
              <Feather name="x" size={13} color={getMuscleGroupColor(muscleFilter)} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMobilityOnly((v) => !v);
            }}
            style={[
              styles.filterChip,
              {
                borderColor: mobilityOnly
                  ? getMuscleGroupColor("Mobility")
                  : theme.border,
                backgroundColor: mobilityOnly
                  ? getMuscleGroupColor("Mobility") + "1A"
                  : "transparent",
              },
            ]}
            testID="chip-picker-mobility"
          >
            <Feather
              name="wind"
              size={13}
              color={mobilityOnly ? getMuscleGroupColor("Mobility") : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.filterChipText,
                {
                  color: mobilityOnly
                    ? getMuscleGroupColor("Mobility")
                    : theme.textSecondary,
                },
              ]}
            >
              {translateMuscleGroup(t, "Mobility")}
            </ThemedText>
          </Pressable>
        </View>

        {pendingCustomName !== null ? (
          <View style={styles.customPanel}>
            <ThemedText style={[styles.customPanelLabel, { color: theme.textSecondary }]}>
              {t("activeWorkout.picker.chooseMuscleGroup")}
            </ThemedText>
            <ThemedText style={styles.customPanelName} numberOfLines={2}>
              {pendingCustomName}
            </ThemedText>
            {creating ? (
              <ActivityIndicator color={Colors.light.primary} style={{ marginTop: Spacing.xl }} />
            ) : (
              <>
                <View style={styles.muscleGrid}>
                  {CUSTOM_MUSCLE_GROUPS.map((mg) => (
                    <Pressable
                      key={mg}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void createCustomExercise(mg);
                      }}
                      style={[
                        styles.muscleOption,
                        { borderColor: getMuscleGroupColor(mg), backgroundColor: getMuscleGroupColor(mg) + "12" },
                      ]}
                      testID={`option-custom-muscle-${mg}`}
                    >
                      <ThemedText style={[styles.muscleOptionText, { color: getMuscleGroupColor(mg) }]}>
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
            data={results}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(item);
                  handleClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border },
                  pressed && { backgroundColor: theme.backgroundDefault },
                ]}
                testID={`row-picker-exercise-${item.id}`}
              >
                <View style={styles.rowInfo}>
                  <ThemedText style={styles.rowName} numberOfLines={1}>
                    {getExerciseDisplayName(
                      { name: item.name, nameDe: item.name_de },
                      i18n.language,
                    )}
                  </ThemedText>
                  <View
                    style={[
                      styles.muscleTag,
                      { backgroundColor: getMuscleGroupColor(item.muscle_group) + "1A" },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.muscleTagText,
                        { color: getMuscleGroupColor(item.muscle_group) },
                      ]}
                    >
                      {translateMuscleGroup(t, item.muscle_group)}
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  {t("activeWorkout.picker.noResults")}
                </ThemedText>
              </View>
            }
            ListFooterComponent={
              canOfferCustom ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPendingCustomName(trimmedQuery);
                  }}
                  style={({ pressed }) => [
                    styles.createRow,
                    { borderColor: Colors.light.primary },
                    pressed && { backgroundColor: Colors.light.primary + "10" },
                  ]}
                  testID="row-create-custom-exercise"
                >
                  <Feather name="plus-circle" size={18} color={Colors.light.primary} />
                  <ThemedText style={[styles.createRowText, { color: Colors.light.primary }]} numberOfLines={1}>
                    {t("activeWorkout.picker.createCustom", { name: trimmedQuery })}
                  </ThemedText>
                </Pressable>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    borderWidth: 1,
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
    borderWidth: 1.5,
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
