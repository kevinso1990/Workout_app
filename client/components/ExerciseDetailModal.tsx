/**
 * ExerciseDetailModal — tappable from the active workout screen.
 *
 * Shows: title · animated GIF (ExerciseDB) · muscle badge · numbered instructions.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { getExerciseMedia as getStaticExerciseMedia } from "@/lib/exerciseMedia/provider";
import { getMuscleGroupMeta } from "@/lib/exerciseImages";
import { translateMuscleGroup, translateExerciseCategory } from "@/lib/exerciseTaxonomy";
import { sanitizeExerciseInstructions } from "@/services/exerciseApi";
import {
  EXERCISE_HERO_GIF_HEIGHT,
  ExerciseDbHeroGif,
} from "@/components/workout/ExerciseDbHeroGif";

interface Props {
  visible: boolean;
  exerciseName: string;
  /** Localized name to show as the title; falls back to `exerciseName` (canonical, used for media lookup). */
  displayName?: string;
  muscleGroup: string;
  onClose: () => void;
}

export default function ExerciseDetailModal({
  visible,
  exerciseName,
  displayName,
  muscleGroup,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [instructions, setInstructions] = useState<string[]>([]);

  const staticMedia = getStaticExerciseMedia(exerciseName);
  const meta = getMuscleGroupMeta(muscleGroup);

  const handleDetailLoaded = useCallback(
    (detail: { gifUrl: string | null; instructions: string[] }) => {
      const steps = sanitizeExerciseInstructions(
        detail.instructions.length ? detail.instructions : staticMedia.cues,
      );
      setInstructions(steps);
    },
    [staticMedia.cues],
  );

  useEffect(() => {
    if (visible) setInstructions([]);
  }, [visible, exerciseName]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.backdropFill} />
      </Pressable>

      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(200)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <ThemedText style={styles.exerciseName} numberOfLines={2}>
                {displayName ?? exerciseName}
              </ThemedText>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: meta.color + "20" }]}>
                  <Feather name={meta.icon as keyof typeof Feather.glyphMap} size={11} color={meta.color} />
                  <ThemedText style={[styles.badgeText, { color: meta.color }]}>
                    {translateMuscleGroup(t, muscleGroup)}
                  </ThemedText>
                </View>
                {staticMedia.category !== "Exercise" ? (
                  <View style={[styles.badge, { backgroundColor: Colors.light.primary + "15" }]}>
                    <ThemedText style={[styles.badgeText, { color: Colors.light.primary }]}>
                      {translateExerciseCategory(t, staticMedia.category)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.backgroundSecondary }]}
              hitSlop={12}
            >
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>

          <ExerciseDbHeroGif
            exerciseName={exerciseName}
            muscleGroup={muscleGroup}
            height={Math.min(EXERCISE_HERO_GIF_HEIGHT, 280)}
            style={styles.mediaContainer}
            onDetailLoaded={handleDetailLoaded}
          />

          <View style={styles.cuesSection}>
            <View style={styles.cuesHeader}>
              <Feather name="check-circle" size={15} color={Colors.light.primary} />
              <ThemedText style={[styles.cuesTitle, { color: Colors.light.primary }]}>
                {t("exercises.howToPerform")}
              </ThemedText>
            </View>

            {instructions.length > 0 ? (
              instructions.map((cue, i) => (
                <View key={`${i}-${cue.slice(0, 20)}`} style={styles.cueRow}>
                  <View style={[styles.cueNumber, { backgroundColor: Colors.light.primary + "15" }]}>
                    <ThemedText style={[styles.cueNumberText, { color: Colors.light.primary }]}>
                      {i + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.cueText, { color: theme.textSecondary }]}>
                    {cue}
                  </ThemedText>
                </View>
              ))
            ) : (
              <ThemedText style={[styles.cueText, { color: theme.textSecondary }]}>
                {t("exercises.noInstructions")}
              </ThemedText>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = "85%";

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdropFill: {
    flex: 1,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SHEET_MAX_HEIGHT,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mediaContainer: {
    marginBottom: Spacing.xl,
  },
  cuesSection: {
    gap: Spacing.sm,
  },
  cuesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  cuesTitle: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  cueNumber: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  cueNumberText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cueText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
});
