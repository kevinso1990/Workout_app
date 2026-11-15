import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { ExerciseVariant, ExerciseVariantTag } from "@/lib/storage";
import { VARIANT_TAGS } from "@/lib/exerciseVariant";

/**
 * How an exercise was done differently today — a weight vest on, a band,
 * kettlebells instead of the trap bar. Kept with the workout so the numbers
 * can be read honestly later.
 */
export function ExerciseVariantSheet({
  exerciseName,
  variant,
  visible,
  onClose,
  onSave,
}: {
  exerciseName: string;
  variant: ExerciseVariant | undefined;
  visible: boolean;
  onClose: () => void;
  onSave: (variant: ExerciseVariant) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tags, setTags] = useState<ExerciseVariantTag[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTags(variant?.tags ?? []);
    setNote(variant?.note ?? "");
  }, [visible, variant]);

  const toggle = (tag: ExerciseVariantTag) => {
    Haptics.selectionAsync();
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };

  const save = () => {
    onSave({ tags, note: note.trim() || undefined });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.handle} />
            <ThemedText style={styles.title}>{t("activeWorkout.variant.title")}</ThemedText>
            <ThemedText style={styles.subtitle} numberOfLines={2}>
              {exerciseName}
            </ThemedText>

            <View style={styles.chips}>
              {VARIANT_TAGS.map((tag) => {
                const on = tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggle(tag)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    testID={`chip-variant-${tag}`}
                  >
                    <ThemedText style={[styles.chipText, on && styles.chipTextOn]}>
                      {t(`activeWorkout.variant.tags.${tag}`)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t("activeWorkout.variant.notePlaceholder")}
              placeholderTextColor={theme.chalkFaint}
              style={styles.input}
              maxLength={120}
              returnKeyType="done"
              onSubmitEditing={save}
              testID="input-variant-note"
            />

            <Pressable onPress={save} style={styles.done} accessibilityRole="button" testID="button-variant-done">
              <ThemedText style={styles.doneText}>{t("activeWorkout.variant.done")}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    sheet: {
      backgroundColor: c.backgroundDefault,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: "center",
      backgroundColor: c.border,
    },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 22,
      color: c.chalk,
    },
    subtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: -Spacing.sm,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: BorderRadius.full,
      borderWidth: 1,
      borderColor: c.controlOutline,
    },
    chipOn: {
      backgroundColor: c.chalk,
      borderColor: c.chalk,
    },
    chipText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.text,
    },
    chipTextOn: {
      color: c.onChalk,
    },
    input: {
      height: 46,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.well,
      borderWidth: 1,
      borderColor: c.hairline,
    },
    done: {
      height: 50,
      borderRadius: BorderRadius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.chalk,
    },
    doneText: {
      fontSize: 16,
      fontWeight: "700",
      color: c.onChalk,
    },
  });
