import React, { useMemo, useState } from "react";
import { View, StyleSheet, Pressable, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import { mergeAvoidLists } from "@shared/avoidExercises";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

/**
 * Type-to-add / tap-to-remove editor for the exercise avoid-list.
 *
 * Shared between onboarding's AvoidExercisesScreen and the Profile card so the
 * interaction (and its styling) can only drift once, not twice — this is the
 * same list either way, just entered the first time vs. revised later.
 */
export function AvoidExerciseEditor({ value, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    Haptics.selectionAsync();
    onChange(mergeAvoidLists(value, [name]));
    setDraft("");
  };

  const remove = (name: string) => {
    Haptics.selectionAsync();
    onChange(value.filter((n) => n !== name));
  };

  return (
    <View>
      <View style={[styles.inputRow, { borderColor: theme.controlOutline, backgroundColor: theme.ironElevated2 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("onboarding.avoidExercises.placeholder", { defaultValue: "z. B. Good Mornings" })}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]}
          returnKeyType="done"
          clearButtonMode="while-editing"
          onSubmitEditing={addDraft}
          testID="input-avoid-exercise"
        />
        <Pressable
          onPress={addDraft}
          disabled={!draft.trim()}
          hitSlop={6}
          style={[styles.addBtn, { backgroundColor: theme.primary, opacity: draft.trim() ? 1 : 0.35 }]}
          testID="button-add-avoid-exercise"
          accessibilityRole="button"
          accessibilityLabel={t("common.add", { defaultValue: "Hinzufügen" })}
        >
          <Feather name="plus" size={18} color={theme.onChalk} />
        </Pressable>
      </View>

      {value.length > 0 ? (
        <View style={styles.chipWrap}>
          {value.map((name) => (
            <Pressable
              key={name}
              onPress={() => remove(name)}
              style={[styles.chip, { backgroundColor: theme.ironElevated2, borderColor: theme.controlOutline }]}
              testID={`chip-avoid-${name}`}
              accessibilityRole="button"
              accessibilityLabel={t("onboarding.avoidExercises.removeA11y", { name, defaultValue: `${name} entfernen` })}
            >
              <ThemedText style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                {name}
              </ThemedText>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: Spacing.sm },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    maxWidth: "100%",
  },
  chipText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
