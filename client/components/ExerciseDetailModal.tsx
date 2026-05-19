/**
 * ExerciseDetailModal — tappable from the active workout screen.
 *
 * Shows: title · animated GIF (ExerciseDB) · muscle badge · numbered instructions.
 */

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { getExerciseMedia as getStaticExerciseMedia } from "@/lib/exerciseMedia/provider";
import { getExerciseMedia as fetchServerExerciseMedia } from "@/services/exerciseMedia";
import { getMuscleGroupMeta, getExerciseImageUrl } from "@/lib/exerciseImages";
import { fetchExerciseDetail, sanitizeExerciseInstructions } from "@/services/exerciseApi";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";

interface Props {
  visible: boolean;
  exerciseName: string;
  muscleGroup: string;
  onClose: () => void;
  gifUrl?: string | null;
}

export default function ExerciseDetailModal({
  visible,
  exerciseName,
  muscleGroup,
  onClose,
  gifUrl: gifUrlProp,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mediaError, setMediaError] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const staticMedia = getStaticExerciseMedia(exerciseName);
  const meta = getMuscleGroupMeta(muscleGroup);
  const staticFallback = getExerciseImageUrl(exerciseName) ?? staticMedia.imageUrl;

  useEffect(() => {
    if (!visible || !exerciseName) return;

    setMediaError(false);
    setMediaLoaded(false);
    setHeroUrl(gifUrlProp ?? staticFallback);
    setInstructions(staticMedia.cues);
    setLoading(true);

    let cancelled = false;

    void (async () => {
      try {
        const [detail, server] = await Promise.all([
          fetchExerciseDetail(exerciseName),
          fetchServerExerciseMedia(exerciseName).catch(() => null),
        ]);
        if (cancelled) return;

        const animated =
          detail?.gifUrl ??
          (server?.gifUrl && !/\.jpe?g($|\?)/i.test(server.gifUrl) ? server.gifUrl : null);

        const steps = sanitizeExerciseInstructions(
          detail?.instructions?.length
            ? detail.instructions
            : server?.correctSteps?.length
              ? server.correctSteps
              : staticMedia.cues,
        );

        setInstructions(steps);
        setHeroUrl(animated ?? gifUrlProp ?? staticFallback);
      } catch {
        if (!cancelled) {
          setHeroUrl(gifUrlProp ?? staticFallback);
          setInstructions(staticMedia.cues);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, exerciseName, gifUrlProp, staticFallback]);

  if (!visible) return null;

  const showHero = !!heroUrl && !mediaError;

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
                {exerciseName}
              </ThemedText>
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: meta.color + "20" }]}>
                  <Feather name={meta.icon as keyof typeof Feather.glyphMap} size={11} color={meta.color} />
                  <ThemedText style={[styles.badgeText, { color: meta.color }]}>
                    {meta.label}
                  </ThemedText>
                </View>
                {staticMedia.category !== "Exercise" ? (
                  <View style={[styles.badge, { backgroundColor: Colors.light.primary + "15" }]}>
                    <ThemedText style={[styles.badgeText, { color: Colors.light.primary }]}>
                      {staticMedia.category}
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

          <View style={styles.mediaContainer}>
            {loading && !mediaLoaded ? (
              <View style={styles.imageWrapper}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
              </View>
            ) : showHero ? (
              <View style={styles.imageWrapper}>
                {!mediaLoaded ? (
                  <View style={StyleSheet.absoluteFill}>
                    <View style={styles.imageSkeleton}>
                      <Feather
                        name={meta.icon as keyof typeof Feather.glyphMap}
                        size={40}
                        color={meta.color + "60"}
                      />
                    </View>
                  </View>
                ) : null}
                <ExerciseGifImage
                  uri={heroUrl!}
                  style={[styles.exerciseImage, !mediaLoaded && { opacity: 0 }]}
                  contentFit="contain"
                  recyclingKey={`${exerciseName}-detail`}
                  onLoad={() => setMediaLoaded(true)}
                  onError={() => {
                    if (heroUrl !== staticFallback && staticFallback) {
                      setHeroUrl(staticFallback);
                      setMediaError(false);
                      setMediaLoaded(false);
                    } else {
                      setMediaError(true);
                    }
                  }}
                />
              </View>
            ) : (
              <View style={[styles.fallbackCard, { backgroundColor: Colors.light.primary }]}>
                <Feather name={meta.icon as keyof typeof Feather.glyphMap} size={52} color={meta.color} />
                <ThemedText style={[styles.fallbackLabel, { color: meta.color }]}>
                  {meta.label}
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.cuesSection}>
            <View style={styles.cuesHeader}>
              <Feather name="check-circle" size={15} color={Colors.light.primary} />
              <ThemedText style={[styles.cuesTitle, { color: Colors.light.primary }]}>
                How to perform
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
                Coaching instructions are not available for this exercise yet.
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
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  imageWrapper: {
    height: 220,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#1A1A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  imageSkeleton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  exerciseImage: {
    width: "100%",
    height: "100%",
  },
  fallbackCard: {
    height: 180,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  fallbackLabel: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
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
