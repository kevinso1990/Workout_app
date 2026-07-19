import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  EXERCISEDB_KEY_HINT,
  isExerciseDbConfigured,
} from "@/lib/rapidApiConfig";
import { fetchExerciseDetail } from "@/services/exerciseApi";
import { getExerciseImageFrames } from "@/lib/exerciseImages";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";
import { ExerciseGifSkeleton } from "@/components/workout/ExerciseGifSkeleton";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Upper-third hero height for workout / detail screens. */
export const EXERCISE_HERO_GIF_HEIGHT = Math.round(SCREEN_HEIGHT / 3);

/** ms between start/end frames of the demonstration flip animation. */
const FLIP_INTERVAL_MS = 720;

type ExerciseDbHeroGifProps = {
  exerciseName: string;
  muscleGroup?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  onDetailLoaded?: (detail: {
    gifUrl: string | null;
    instructions: string[];
  }) => void;
};

/**
 * Two-frame demonstration animation built from the free-exercise-db start/end
 * images. Both frames are mounted and cross-toggled via opacity so there's no
 * reload flicker. Falls back to a single frame if the end image is missing.
 */
function FlipFrames({
  frames,
  exerciseName,
  onReady,
}: {
  frames: string[];
  exerciseName: string;
  onReady: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [lastFrame, setLastFrame] = useState(frames.length - 1);

  useEffect(() => {
    setIdx(0);
    setLastFrame(frames.length - 1);
  }, [frames]);

  useEffect(() => {
    if (lastFrame < 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1 > lastFrame ? 0 : i + 1));
    }, FLIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [lastFrame]);

  return (
    <>
      {frames.map((uri, i) => (
        <ExerciseGifImage
          key={uri}
          uri={uri}
          style={[styles.image, i !== idx && styles.imageHidden]}
          contentFit="contain"
          recyclingKey={`${exerciseName}-frame-${i}`}
          onLoad={i === 0 ? onReady : undefined}
          onError={() => {
            // End frame missing → collapse to a single static frame.
            if (i >= 1) setLastFrame(0);
          }}
        />
      ))}
    </>
  );
}

/**
 * Renders an animated exercise demonstration.
 *
 * Image source precedence:
 *   1. free-exercise-db start/end frames (CORS-free GitHub CDN) — always works
 *      for mapped exercises and is used as the primary animation.
 *   2. ExerciseDB (RapidAPI) GIF — used only when no static frames exist.
 *
 * Instructions are still fetched from ExerciseDB regardless so the modal can
 * show coaching cues.
 */
export function ExerciseDbHeroGif({
  exerciseName,
  height = EXERCISE_HERO_GIF_HEIGHT,
  style,
  dark = false,
  onDetailLoaded,
}: ExerciseDbHeroGifProps) {
  const frames = useMemo(
    () => getExerciseImageFrames(exerciseName),
    [exerciseName],
  );
  const hasFrames = frames.length > 0;

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const requestRef = useRef(0);
  const onDetailLoadedRef = useRef(onDetailLoaded);
  onDetailLoadedRef.current = onDetailLoaded;

  useEffect(() => {
    const requestId = ++requestRef.current;
    setFetchDone(false);
    setImageReady(false);
    setResolvedUrl(null);

    void (async () => {
      const detail = await fetchExerciseDetail(exerciseName);
      if (requestRef.current !== requestId) return;

      const animated = detail?.gifUrl ?? null;
      // Only use the RapidAPI GIF for the image when we have no static frames.
      setResolvedUrl(hasFrames ? null : animated);
      setFetchDone(true);
      onDetailLoadedRef.current?.({
        gifUrl: animated,
        instructions: detail?.instructions ?? [],
      });

      if (hasFrames || !animated) {
        setImageReady(true);
      }
    })();

    return () => {
      requestRef.current += 1;
    };
  }, [exerciseName, hasFrames]);

  const skeletonBase = dark ? "#1C1C1E" : "#E8E8ED";
  const skeletonPulse = dark ? "#2C2C2E" : "#F4F4F8";

  // With static frames we never block on the network — show the animation
  // immediately and just wait for the first image to decode.
  const showSkeleton = hasFrames
    ? !imageReady
    : !fetchDone || (resolvedUrl !== null && !imageReady);
  const showKeyHint =
    !hasFrames && fetchDone && !resolvedUrl && !isExerciseDbConfigured();
  const showUnavailable =
    !hasFrames && fetchDone && !resolvedUrl && !showKeyHint;

  return (
    <View
      style={[styles.frame, { height }, dark && styles.frameDark, style]}
    >
      {showSkeleton ? (
        <ExerciseGifSkeleton
          style={StyleSheet.absoluteFill}
          baseColor={skeletonBase}
          pulseColor={skeletonPulse}
        />
      ) : null}

      {hasFrames ? (
        <FlipFrames
          frames={frames}
          exerciseName={exerciseName}
          onReady={() => setImageReady(true)}
        />
      ) : resolvedUrl ? (
        <ExerciseGifImage
          uri={resolvedUrl}
          style={[styles.image, !imageReady && styles.imageHidden]}
          contentFit="contain"
          recyclingKey={`${exerciseName}-hero-${resolvedUrl}`}
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
      ) : showKeyHint ? (
        <View style={styles.hintWrap}>
          <Text style={[styles.hintText, dark && styles.hintTextDark]}>
            {EXERCISEDB_KEY_HINT}
          </Text>
        </View>
      ) : showUnavailable ? (
        <View style={styles.hintWrap}>
          <Text style={[styles.hintText, dark && styles.hintTextDark]}>
            Animation unavailable for this exercise.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
  },
  frameDark: {
    backgroundColor: "#121212",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  imageHidden: {
    opacity: 0,
  },
  hintWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: "#8E8E93",
  },
  hintTextDark: {
    color: "rgba(255,255,255,0.65)",
  },
});
