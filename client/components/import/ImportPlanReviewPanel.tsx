import React, { useMemo, useState} from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import { HEVY } from "@/constants/hevyLayout";
import type { ImportedExercise, ImportedWorkoutPlan } from "@/hooks/useWorkoutImport";
import {
  type CatalogRow,
  isImportedExerciseUnmapped,
  rankCatalogMatches,
} from "@/lib/importCatalog";
import { parseRepsInput, repsInputValue } from "@/lib/importReps";
import { translateMuscleGroup } from "@/lib/exerciseTaxonomy";

type InlinePick = { dayIdx: number; exIdx: number } | null;

type ImportPlanReviewPanelProps = {
  plan: ImportedWorkoutPlan;
  planName: string;
  onPlanNameChange: (name: string) => void;
  catalog: CatalogRow[];
  catalogLoading: boolean;
  headerPaddingTop: number;
  onUpdateExercise: (
    dayIdx: number,
    exIdx: number,
    patch: Partial<ImportedExercise>,
  ) => void;
  onRemoveExercise: (dayIdx: number, exIdx: number) => void;
  onAddExercise: (dayIdx: number) => void;
  onSave: () => void;
  onCancel: () => void;
  introHint?: string;
};

function PrimarySaveButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primarySaveBtn,
        {
          backgroundColor: theme.primary,
          opacity: disabled ? 0.45 : pressed ? 0.92 : 1,
        },
      ]}
      testID="button-import-save-plan"
    >
      <Feather name="check" size={20} color={theme.onChalk} />
      <ThemedText style={styles.primarySaveBtnText}>{label}</ThemedText>
    </Pressable>
  );
}

export function ImportPlanReviewPanel({
  plan,
  planName,
  onPlanNameChange,
  catalog,
  catalogLoading,
  headerPaddingTop,
  onUpdateExercise,
  onRemoveExercise,
  onAddExercise,
  onSave,
  onCancel,
  introHint,
}: ImportPlanReviewPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [inlinePick, setInlinePick] = useState<InlinePick>(null);
  const [inlineQuery, setInlineQuery] = useState("");

  const totalExercises = plan.days.reduce((n, d) => n + d.exercises.length, 0);
  const unmappedCount = plan.days.reduce(
    (n, d) => n + d.exercises.filter(isImportedExerciseUnmapped).length,
    0,
  );

  const openInlinePicker = (dayIdx: number, exIdx: number, ex: ImportedExercise) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const seed = ex.importMeta?.originalName?.trim() || ex.name;
    setInlineQuery(seed);
    setInlinePick({ dayIdx, exIdx });
  };

  const applyCatalogRow = (dayIdx: number, exIdx: number, row: CatalogRow) => {
    onUpdateExercise(dayIdx, exIdx, {
      name: row.name,
      muscleGroup: row.muscle_group,
      catalogExerciseId: row.id,
      importMeta: {
        originalName: row.name,
        matchQuality: "exact",
        needsUserMapping: false,
      },
    });
    setInlinePick(null);
    setInlineQuery("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const inlineSuggestions = useMemo(() => {
    if (!inlinePick) return [];
    const ex = plan.days[inlinePick.dayIdx]?.exercises[inlinePick.exIdx];
    if (!ex) return [];
    const q = inlineQuery.trim().toLowerCase();
    if (!q) return rankCatalogMatches(ex, catalog, 8);
    return catalog
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.muscle_group.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [inlinePick, inlineQuery, catalog, plan.days]);

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: headerPaddingTop,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(350)}>
          <ThemedText style={styles.title}>{t("importWorkout.review.title")}</ThemedText>
          <ThemedText style={styles.subtitle}>
            {introHint ??
              t("importWorkout.review.subtitle", { count: totalExercises })}
            {unmappedCount > 0
              ? ` · ${t("importWorkout.review.unmappedCount", { count: unmappedCount })}`
              : ""}
          </ThemedText>
        </Animated.View>

        <ThemedText style={styles.sectionLabel}>
          {t("importWorkout.review.planName")}
        </ThemedText>
        <TextInput
          clearButtonMode="while-editing"
          style={styles.planNameInput}
          value={planName}
          onChangeText={onPlanNameChange}
          placeholder={t("importWorkout.review.planName")}
          placeholderTextColor={theme.chalkFaint}
          returnKeyType="done"
        />

        {plan.days.map((day, dayIdx) => (
          <View key={dayIdx} style={styles.dayBlock}>
            <ThemedText style={styles.dayTitle}>
              {day.dayName}
            </ThemedText>

            {day.exercises.map((ex, exIdx) => {
              const unmapped = isImportedExerciseUnmapped(ex);
              const pickerOpen =
                inlinePick?.dayIdx === dayIdx && inlinePick?.exIdx === exIdx;

              return (
                <View key={`${dayIdx}-${exIdx}`}>
                  <Pressable
                    onPress={() => {
                      if (unmapped || pickerOpen) {
                        openInlinePicker(dayIdx, exIdx, ex);
                      }
                    }}
                    style={[
                      styles.exerciseCard,
                      unmapped && styles.exerciseCardUnmapped,
                    ]}
                  >
                    {unmapped ? (
                      <View
                        style={[
                          styles.unmappedBanner,
                          {
                            backgroundColor: theme.primary + "0A",
                            borderColor: theme.primary + "28",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.unmappedIconWrap,
                            { backgroundColor: theme.primary + "18" },
                          ]}
                        >
                          <Feather
                            name="info"
                            size={13}
                            color={theme.primary}
                          />
                        </View>
                        <ThemedText
                          style={[
                            styles.unmappedLabel,
                            { color: theme.primary },
                          ]}
                        >
                          {t("importWorkout.review.unknownExercise")}
                        </ThemedText>
                      </View>
                    ) : null}

                    <View style={styles.exerciseCardHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.miniLabel}>
                          {t("importWorkout.review.exercise")}
                        </ThemedText>
                        <TextInput
                          returnKeyType="done"
                          clearButtonMode="while-editing"
                          style={styles.nameInput}
                          value={ex.name}
                          onChangeText={(text) =>
                            onUpdateExercise(dayIdx, exIdx, {
                              name: text,
                              catalogExerciseId: null,
                              importMeta: {
                                originalName:
                                  ex.importMeta?.originalName ?? ex.name,
                                matchQuality: "uncertain",
                                needsUserMapping: true,
                              },
                            })
                          }
                          placeholder={t("importWorkout.review.exercise")}
                          placeholderTextColor={theme.chalkFaint}
                        />
                      </View>
                      <Pressable
                        onPress={() => onRemoveExercise(dayIdx, exIdx)}
                        hitSlop={12}
                        style={styles.deleteBtn}
                        accessibilityLabel={t("importWorkout.review.deleteExercise")}
                      >
                        <Feather name="trash-2" size={18} color={theme.chalkFaint} />
                      </Pressable>
                    </View>

                    {ex.importMeta?.originalName &&
                    ex.importMeta.originalName.trim().toLowerCase() !==
                      ex.name.trim().toLowerCase() ? (
                      <ThemedText style={styles.documentLine}>
                        {t("importWorkout.review.documentRead", {
                          name: ex.importMeta.originalName,
                        })}
                      </ThemedText>
                    ) : null}

                    <View style={styles.metricsRow}>
                      <View style={styles.metricCell}>
                        <ThemedText style={styles.miniLabel}>
                          {t("importWorkout.review.sets")}
                        </ThemedText>
                        <TextInput
                          selectTextOnFocus
                          style={styles.metricInput}
                          keyboardType="number-pad"
                          value={String(ex.sets)}
                          onChangeText={(text) => {
                            const n = parseInt(text.replace(/\D/g, ""), 10);
                            onUpdateExercise(dayIdx, exIdx, {
                              sets:
                                Number.isFinite(n) && n > 0
                                  ? Math.min(99, n)
                                  : 1,
                            });
                          }}
                        />
                      </View>
                      <View style={styles.metricCell}>
                        <ThemedText style={styles.miniLabel}>
                          {t("importWorkout.review.reps")}
                        </ThemedText>
                        <TextInput
                          returnKeyType="done"
                          clearButtonMode="while-editing"
                          style={styles.metricInput}
                          keyboardType="default"
                          autoCapitalize="none"
                          autoCorrect={false}
                          value={repsInputValue(ex)}
                          placeholder="8-12"
                          placeholderTextColor={theme.chalkFaint}
                          onChangeText={(text) => {
                            onUpdateExercise(dayIdx, exIdx, {
                              reps: parseRepsInput(text),
                            });
                          }}
                        />
                      </View>
                      <View style={styles.metricCell}>
                        <ThemedText style={styles.miniLabel}>
                          {t("importWorkout.review.weight")}
                        </ThemedText>
                        <TextInput
                          selectTextOnFocus
                          style={styles.metricInput}
                          keyboardType="decimal-pad"
                          value={ex.weight !== null ? String(ex.weight) : ""}
                          placeholder="—"
                          placeholderTextColor={theme.chalkFaint}
                          onChangeText={(text) => {
                            const trimmed = text.replace(",", ".").trim();
                            if (!trimmed) {
                              onUpdateExercise(dayIdx, exIdx, { weight: null });
                              return;
                            }
                            const n = parseFloat(trimmed);
                            onUpdateExercise(dayIdx, exIdx, {
                              weight: Number.isFinite(n)
                                ? Math.round(n * 10) / 10
                                : null,
                            });
                          }}
                        />
                      </View>
                    </View>

                    {unmapped ? (
                      <Pressable
                        onPress={() => openInlinePicker(dayIdx, exIdx, ex)}
                        style={[
                          styles.assignChip,
                          { borderColor: theme.primary },
                        ]}
                      >
                        <Feather name="search" size={14} color={theme.primary} />
                        <ThemedText
                          style={[styles.assignChipText, { color: theme.primary }]}
                        >
                          {t("importWorkout.review.assignFromCatalog")}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </Pressable>

                  {pickerOpen ? (
                    <View style={styles.inlinePicker}>
                      <View style={styles.inlineSearch}>
                        <Feather name="search" size={16} color={theme.chalkFaint} />
                        <TextInput
                          clearButtonMode="while-editing"
                          autoCapitalize="none"
                          style={styles.inlineSearchInput}
                          value={inlineQuery}
                          onChangeText={setInlineQuery}
                          placeholder={t("importWorkout.review.searchPlaceholder")}
                          placeholderTextColor={theme.chalkFaint}
                          autoFocus={true}
                          autoCorrect={false}
                          returnKeyType="search"
                        />
                        <Pressable
                          onPress={() => {
                            setInlinePick(null);
                            setInlineQuery("");
                          }}
                          hitSlop={8}
                        >
                          <Feather name="x" size={18} color={theme.chalkFaint} />
                        </Pressable>
                      </View>
                      {catalogLoading ? (
                        <ThemedText style={styles.inlineEmpty}>…</ThemedText>
                      ) : (
                        <FlatList
                          keyboardDismissMode="on-drag"
                          data={inlineSuggestions}
                          keyExtractor={(item) => String(item.id)}
                          keyboardShouldPersistTaps="handled"
                          nestedScrollEnabled
                          scrollEnabled={inlineSuggestions.length > 4}
                          style={{ maxHeight: 200 }}
                          renderItem={({ item }) => (
                            <Pressable
                              onPress={() => applyCatalogRow(dayIdx, exIdx, item)}
                              android_disableSound
                              style={({ pressed }) => [
                                styles.inlineRow,
                                {
                                  backgroundColor: pressed
                                    ? theme.primary + "14"
                                    : "transparent",
                                },
                              ]}
                            >
                              <ThemedText style={styles.inlineRowName}>
                                {item.name}
                              </ThemedText>
                              <ThemedText style={styles.inlineRowSub}>
                                {translateMuscleGroup(t, item.muscle_group)}
                              </ThemedText>
                            </Pressable>
                          )}
                          ListEmptyComponent={
                            <ThemedText style={styles.inlineEmpty}>
                              {t("importWorkout.review.noMatches")}
                            </ThemedText>
                          }
                        />
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Pressable
              onPress={() => onAddExercise(dayIdx)}
              style={styles.addRowBtn}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText style={[styles.addRowText, { color: theme.primary }]}>
                {t("importWorkout.review.addExercise")}
              </ThemedText>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={onCancel} style={styles.cancelLink}>
          <ThemedText style={styles.cancelLinkText}>
            {t("importWorkout.review.cancel")}
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + HEVY.pad }]}
      >
        <PrimarySaveButton
          label={t("importWorkout.review.saveToPlans")}
          onPress={onSave}
          disabled={totalExercises === 0}
        />
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.iron },
  scroll: {
    paddingHorizontal: HEVY.pad,
    gap: HEVY.pad,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: c.chalk,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.sm,
    color: c.chalkDim,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    color: c.chalkFaint,
  },
  planNameInput: {
    height: Spacing.inputHeight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.md,
    paddingHorizontal: HEVY.pad,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    backgroundColor: c.ironElevated2,
    color: c.chalk,
  },
  dayBlock: {
    marginTop: HEVY.padLg,
    gap: HEVY.pad,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    color: c.chalkFaint,
  },
  exerciseCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.md,
    padding: HEVY.pad,
    gap: HEVY.pad,
    backgroundColor: c.ironElevated2,
  },
  exerciseCardUnmapped: {
    borderColor: c.primary + "55",
    backgroundColor: c.primary + "08",
  },
  unmappedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unmappedIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  unmappedLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    lineHeight: 17,
  },
  exerciseCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    color: c.chalkFaint,
  },
  nameInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    minHeight: 44,
    color: c.chalk,
    backgroundColor: c.iron,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  documentLine: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 16,
    color: c.chalkDim,
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricCell: { flex: 1, minWidth: 0 },
  metricInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    minHeight: 44,
    textAlign: "center",
    color: c.chalk,
    backgroundColor: c.iron,
  },
  assignChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  assignChipText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  inlinePicker: {
    marginTop: Spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.primary + "40",
    borderRadius: BorderRadius.md,
    padding: HEVY.pad,
    gap: HEVY.pad,
    backgroundColor: c.ironElevated2,
  },
  inlineSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: 44,
    backgroundColor: c.iron,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: c.chalk,
  },
  inlineRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  inlineRowName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: c.chalk,
  },
  inlineRowSub: { fontSize: 12, marginTop: 2, color: c.chalkDim },
  inlineEmpty: {
    textAlign: "center",
    padding: Spacing.md,
    fontSize: 14,
    color: c.chalkFaint,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    borderRadius: BorderRadius.md,
    borderStyle: "dashed",
    minHeight: 48,
    backgroundColor: c.ironElevated2,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  cancelLinkText: {
    fontSize: 14,
    fontWeight: "500",
    color: c.chalkFaint,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: HEVY.pad,
    paddingTop: HEVY.pad,
    backgroundColor: c.iron,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hairline,
  },
  primarySaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: BorderRadius.md,
  },
  primarySaveBtnText: {
    color: c.onChalk,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
