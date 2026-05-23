import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useVideoPlayer, VideoView } from "expo-video";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  getExerciseMedia,
  clearExerciseMediaCache,
} from "@/services/exerciseMedia";
import { fetchExerciseDetail, sanitizeExerciseInstructions } from "@/services/exerciseApi";
import { ExerciseDbHeroGif } from "@/components/workout/ExerciseDbHeroGif";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";

const CUSTOM_POLL_INTERVAL_MS = 3000;
const CUSTOM_POLL_MAX_RETRIES = 8;

function CustomExercisePlaceholder() {
  const { theme } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withSpring(0.4, { damping: 6, stiffness: 60 });
    const interval = setInterval(() => {
      opacity.value =
        opacity.value < 0.6
          ? withSpring(1, { damping: 6, stiffness: 60 })
          : withSpring(0.4, { damping: 6, stiffness: 60 });
    }, 900);
    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.customPlaceholderContainer}>
      <Animated.View
        style={[
          styles.customPlaceholderIconWrap,
          { backgroundColor: Colors.light.primary + "15" },
          animatedStyle,
        ]}
      >
        <Feather name="image" size={40} color={Colors.light.primary} />
      </Animated.View>
      <ThemedText style={[styles.customPlaceholderTitle, { color: theme.text }]}>
        Preview Loading
      </ThemedText>
      <ThemedText
        style={[styles.customPlaceholderSubtitle, { color: theme.textSecondary }]}
      >
        Your exercise preview is being prepared. It will appear here shortly.
      </ThemedText>
      <ActivityIndicator
        size="small"
        color={Colors.light.primary}
        style={{ marginTop: Spacing.md }}
      />
    </View>
  );
}

interface GifPreviewModalProps {
  exerciseName: string | null;
  visible: boolean;
  onClose: () => void;
  isCustom?: boolean;
  closeButtonTestID?: string;
  formTipsToggleTestID?: string;
}

export default function GifPreviewModal({
  exerciseName,
  visible,
  onClose,
  isCustom,
  closeButtonTestID = "button-gif-close",
  formTipsToggleTestID = "button-form-tips-toggle",
}: GifPreviewModalProps) {
  const { theme } = useTheme();
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [videoMp4, setVideoMp4] = useState<string | null>(null);
  const [correctSteps, setCorrectSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const pollRetryRef = React.useRef(0);
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer("", (p) => {
    p.loop = true;
    p.muted = true;
  });
  const safePlayerPause = () => { try { player.pause(); } catch {} };

  const applyMedia = React.useCallback(
    (
      media: {
        gifUrl: string | null;
        videoMp4: string | null;
        correctSteps: string[];
      },
      playerRef: ReturnType<typeof useVideoPlayer>
    ) => {
      setGifUrl(media.gifUrl);
      setVideoMp4(media.videoMp4);
      setCorrectSteps(
        Array.isArray(media.correctSteps) ? media.correctSteps : []
      );
      if (media.videoMp4) {
        playerRef.replace({ uri: media.videoMp4 });
        playerRef.play();
      }
    },
    []
  );

  useEffect(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollRetryRef.current = 0;

    if (!visible || !exerciseName) {
      safePlayerPause();
      return;
    }
    setLoading(true);
    setGifUrl(null);
    setVideoMp4(null);
    setCorrectSteps([]);
    setTipsExpanded(false);

    Promise.all([
      getExerciseMedia(exerciseName),
      fetchExerciseDetail(exerciseName),
    ])
      .then(([media, detail]) => {
        const animatedGif =
          detail?.gifUrl ??
          (media.gifUrl && !/\.jpe?g($|\?)/i.test(media.gifUrl) ? media.gifUrl : null);
        const steps = sanitizeExerciseInstructions(
          detail?.instructions?.length
            ? detail.instructions
            : media.correctSteps,
        );

        applyMedia(
          {
            gifUrl: animatedGif,
            videoMp4: media.videoMp4,
            correctSteps: steps,
          },
          player,
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      safePlayerPause();
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [visible, exerciseName]);

  useEffect(() => {
    if (!isCustom || !visible || !exerciseName) return;
    if (gifUrl !== null || videoMp4 !== null) return;
    if (loading) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || pollRetryRef.current >= CUSTOM_POLL_MAX_RETRIES) return;
      pollRetryRef.current += 1;
      await clearExerciseMediaCache(exerciseName);
      const media = await getExerciseMedia(exerciseName);
      if (cancelled) return;
      if (media.gifUrl !== null || media.videoMp4 !== null) {
        applyMedia(media, player);
      } else {
        pollTimerRef.current = setTimeout(poll, CUSTOM_POLL_INTERVAL_MS);
      }
    };

    pollTimerRef.current = setTimeout(poll, CUSTOM_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isCustom, visible, exerciseName, gifUrl, videoMp4, loading]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.gifOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.gifModalBox,
            { backgroundColor: theme.backgroundDefault },
          ]}
          onPress={() => {}}
        >
          <View style={styles.gifModalHeader}>
            <ThemedText style={styles.gifModalTitle} numberOfLines={2}>
              {exerciseName ?? ""}
            </ThemedText>
            <Pressable
              onPress={onClose}
              style={styles.gifModalClose}
              testID={closeButtonTestID}
            >
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.gifContainer}>
            {videoMp4 ? (
              <VideoView
                player={player}
                style={styles.gifImage}
                contentFit="contain"
                nativeControls={false}
              />
            ) : isCustom && !gifUrl && !videoMp4 ? (
              <CustomExercisePlaceholder />
            ) : exerciseName ? (
              <ExerciseDbHeroGif
                exerciseName={exerciseName}
                height={280}
                style={styles.gifHero}
                onDetailLoaded={(detail) => {
                  const steps = sanitizeExerciseInstructions(detail.instructions);
                  if (steps.length > 0) {
                    setCorrectSteps(steps);
                  }
                }}
              />
            ) : gifUrl ? (
              <ExerciseGifImage
                uri={gifUrl}
                style={styles.gifImage}
                contentFit="contain"
                recyclingKey={`${exerciseName ?? "gif"}-preview`}
              />
            ) : loading ? (
              <CustomExercisePlaceholder />
            ) : (
              <View style={styles.gifNoPreview}>
                <Feather name="film" size={40} color={theme.textSecondary} />
                <ThemedText
                  style={[styles.gifNoPreviewText, { color: theme.textSecondary }]}
                >
                  No preview available
                </ThemedText>
              </View>
            )}
          </View>
          {correctSteps.length > 0 ? (
            <View style={styles.formTipsSection}>
              <Pressable
                onPress={() => setTipsExpanded((prev) => !prev)}
                style={[
                  styles.formTipsToggle,
                  { borderColor: theme.backgroundSecondary },
                ]}
                testID={formTipsToggleTestID}
              >
                <Feather
                  name="check-circle"
                  size={15}
                  color={Colors.light.primary}
                />
                <ThemedText
                  style={[styles.formTipsToggleText, { color: theme.text }]}
                >
                  Instructions ({correctSteps.length})
                </ThemedText>
                <Feather
                  name={tipsExpanded ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={theme.textSecondary}
                />
              </Pressable>
              {tipsExpanded ? (
                <ScrollView
                  style={styles.formTipsScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {correctSteps.map((step, index) => (
                    <View key={index} style={styles.formTipRow}>
                      <View
                        style={[
                          styles.formTipBadge,
                          {
                            backgroundColor: Colors.light.primary + "15",
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.formTipBadgeText,
                            { color: Colors.light.primary },
                          ]}
                        >
                          {index + 1}
                        </ThemedText>
                      </View>
                      <ThemedText
                        style={[styles.formTipText, { color: theme.text }]}
                      >
                        {step}
                      </ThemedText>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gifOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  gifModalBox: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "85%",
  },
  gifModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  gifModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    flex: 1,
    marginRight: Spacing.md,
  },
  gifModalClose: {
    padding: Spacing.xs,
  },
  gifContainer: {
    width: "100%",
    height: 280,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F5F5F5",
    overflow: "hidden",
  },
  gifHero: {
    width: "100%",
    borderRadius: BorderRadius.lg,
  },
  gifImage: {
    width: "100%",
    height: "100%",
  },
  gifNoPreview: {
    alignItems: "center",
    gap: Spacing.md,
  },
  gifNoPreviewText: {
    fontSize: 15,
    textAlign: "center",
  },
  formTipsSection: {
    marginTop: Spacing.md,
  },
  formTipsToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  formTipsToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  formTipsScroll: {
    maxHeight: 200,
    marginTop: Spacing.sm,
  },
  formTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  formTipBadge: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  formTipBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  formTipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  customPlaceholderContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  customPlaceholderIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  customPlaceholderTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
  },
  customPlaceholderSubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});
