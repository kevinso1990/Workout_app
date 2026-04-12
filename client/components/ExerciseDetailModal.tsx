/**
 * ExerciseDetailModal — tappable from the active workout screen.
 *
 * Shows:  title · image (or fallback card) · muscle-group badge ·
 *         category tag · numbered form cues
 *
 * Provider hook-in: swapping to YMove requires only changing
 * ACTIVE_MEDIA_PROVIDER in exerciseMedia/config.ts — this component is
 * provider-agnostic.
 */

import React, { useEffect } from "react";
import {
  Modal,
  View,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { getExerciseMedia } from "@/lib/exerciseMedia/provider";
import { getMuscleGroupMeta } from "@/lib/exerciseImages";

interface Props {
  visible: boolean;
  exerciseName: string;
  muscleGroup: string;
  onClose: () => void;
}

export default function ExerciseDetailModal({
  visible,
  exerciseName,
  muscleGroup,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [imageError, setImageError] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  // Reset image state when exercise changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [exerciseName]);

  if (!visible) return null;

  const media = getExerciseMedia(exerciseName);
  const meta = getMuscleGroupMeta(muscleGroup);
  const showImage = !!media.imageUrl && !imageError;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.backdropFill} />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(200)}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        // Prevent backdrop tap from firing through the sheet
        pointerEvents="box-none"
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: theme.border }]} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header row: title + close */}
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <ThemedText style={styles.exerciseName} numberOfLines={2}>
                {exerciseName}
              </ThemedText>
              <View style={styles.badges}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: meta.color + "20" },
                  ]}
                >
                  <Feather name={meta.icon as any} size={11} color={meta.color} />
                  <ThemedText style={[styles.badgeText, { color: meta.color }]}>
                    {meta.label}
                  </ThemedText>
                </View>
                {media.category !== "Exercise" && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: Colors.light.primary + "15" },
                    ]}
                  >
                    <ThemedText
                      style={[styles.badgeText, { color: Colors.light.primary }]}
                    >
                      {media.category}
                    </ThemedText>
                  </View>
                )}
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

          {/* Image / fallback card */}
          <View style={styles.mediaContainer}>
            {showImage ? (
              <View style={styles.imageWrapper}>
                {!imageLoaded && (
                  <LinearGradient
                    colors={[meta.color + "18", meta.color + "35"]}
                    style={StyleSheet.absoluteFill}
                  >
                    <View style={styles.imageSkeleton}>
                      <Feather
                        name={meta.icon as any}
                        size={40}
                        color={meta.color + "60"}
                      />
                    </View>
                  </LinearGradient>
                )}
                <Image
                  source={{ uri: media.imageUrl! }}
                  style={[styles.exerciseImage, !imageLoaded && { opacity: 0 }]}
                  resizeMode="cover"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setImageError(true);
                    setImageLoaded(false);
                  }}
                />
              </View>
            ) : (
              <LinearGradient
                colors={[meta.color + "18", meta.color + "40"]}
                style={styles.fallbackCard}
              >
                <Feather name={meta.icon as any} size={52} color={meta.color} />
                <ThemedText style={[styles.fallbackLabel, { color: meta.color }]}>
                  {meta.label}
                </ThemedText>
              </LinearGradient>
            )}
          </View>

          {/* Form cues */}
          <View style={styles.cuesSection}>
            <View style={styles.cuesHeader}>
              <Feather name="check-circle" size={15} color={Colors.light.primary} />
              <ThemedText
                style={[styles.cuesTitle, { color: Colors.light.primary }]}
              >
                Form Cues
              </ThemedText>
            </View>

            {media.cues.map((cue, i) => (
              <View key={i} style={styles.cueRow}>
                <View
                  style={[
                    styles.cueNumber,
                    { backgroundColor: Colors.light.primary + "15" },
                  ]}
                >
                  <ThemedText
                    style={[styles.cueNumberText, { color: Colors.light.primary }]}
                  >
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.cueText, { color: theme.textSecondary }]}
                >
                  {cue}
                </ThemedText>
              </View>
            ))}
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
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
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
    borderRadius: 17,
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
  },
  imageSkeleton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    borderRadius: 12,
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
