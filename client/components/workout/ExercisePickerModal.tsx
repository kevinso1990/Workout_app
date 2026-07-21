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
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { translateMuscleGroup, getMuscleGroupColor, isMobilityExercise } from "@/lib/exerciseTaxonomy";
import type { CatalogRow } from "@/lib/importCatalog";

export type PickerExercise = CatalogRow;

interface ExercisePickerModalProps {
  visible: boolean;
  title: string;
  /** Exercise names already in this workout — filtered out of results. */
  excludeNames?: Set<string>;
  onClose: () => void;
  onSelect: (exercise: PickerExercise) => void;
}

export function ExercisePickerModal({
  visible,
  title,
  excludeNames,
  onClose,
  onSelect,
}: ExercisePickerModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobilityOnly, setMobilityOnly] = useState(false);

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
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscle_group.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, excludeNames, mobilityOnly]);

  const handleClose = () => {
    setQuery("");
    setMobilityOnly(false);
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

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.centerFill}>
            <ThemedText style={{ color: theme.textSecondary }}>
              {t("activeWorkout.picker.noResults")}
            </ThemedText>
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
                    {item.name}
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
});
