import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { getExerciseImageUrl, getMuscleGroupMeta } from "@/lib/exerciseImages";
import { fetchExerciseDetail } from "@/services/exerciseApi";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";
import { ExerciseGifSkeleton } from "@/components/workout/ExerciseGifSkeleton";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/** Upper-third hero height for workout / detail screens. */
export const EXERCISE_HERO_GIF_HEIGHT = Math.round(SCREEN_HEIGHT / 3);

type ExerciseDbHeroGifProps = {
  exerciseName: string;
  muscleGroup?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  fallbackUri?: string | null;
  dark?: boolean;
  onDetailLoaded?: (detail: {
    gifUrl: string | null;
    instructions: string[];
  }) => void;
};

/**
 * Loads ExerciseDB `gifUrl` and renders it large with a pulsing skeleton
 * until the image has finished loading (prevents layout shift).
 */
export function ExerciseDbHeroGif({
  exerciseName,
  muscleGroup,
  height = EXERCISE_HERO_GIF_HEIGHT,
  style,
  fallbackUri,
  dark = false,
  onDetailLoaded,
}: ExerciseDbHeroGifProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const requestRef = useRef(0);
  const onDetailLoadedRef = useRef(onDetailLoaded);
  onDetailLoadedRef.current = onDetailLoaded;

  const staticFallback = fallbackUri ?? getExerciseImageUrl(exerciseName);
  const meta = muscleGroup ? getMuscleGroupMeta(muscleGroup) : null;

  useEffect(() => {
    const requestId = ++requestRef.current;
    setFetchDone(false);
    setImageReady(false);
    setResolvedUrl(null);

    void (async () => {
      const detail = await fetchExerciseDetail(exerciseName);
      if (requestRef.current !== requestId) return;

      const animated = detail?.gifUrl ?? null;
      const display = animated ?? staticFallback ?? null;
      setResolvedUrl(display);
      setFetchDone(true);
      onDetailLoadedRef.current?.({
        gifUrl: animated,
        instructions: detail?.instructions ?? [],
      });

      if (!display) {
        setImageReady(true);
      }
    })();

    return () => {
      requestRef.current += 1;
    };
  }, [exerciseName, staticFallback]);

  const showSkeleton = !fetchDone || (resolvedUrl !== null && !imageReady);
  const skeletonBase = dark ? "#1C1C1E" : "#E8E8ED";
  const skeletonPulse = dark ? "#2C2C2E" : "#F4F4F8";

  return (
    <View
      style={[
        styles.frame,
        { height },
        dark && styles.frameDark,
        style,
      ]}
    >
      {showSkeleton ? (
        <ExerciseGifSkeleton
          style={StyleSheet.absoluteFill}
          baseColor={skeletonBase}
          pulseColor={skeletonPulse}
        />
      ) : null}

      {resolvedUrl ? (
        <ExerciseGifImage
          uri={resolvedUrl}
          style={[styles.image, !imageReady && styles.imageHidden]}
          contentFit="contain"
          recyclingKey={`${exerciseName}-hero-${resolvedUrl}`}
          onLoad={() => setImageReady(true)}
          onError={() => {
            if (resolvedUrl !== staticFallback && staticFallback) {
              setResolvedUrl(staticFallback);
              setImageReady(false);
            } else {
              setImageReady(true);
            }
          }}
        />
      ) : fetchDone ? (
        <View style={styles.fallback}>
          <Feather
            name={(meta?.icon as keyof typeof Feather.glyphMap) ?? "activity"}
            size={40}
            color={meta?.color ?? "#8E8E93"}
          />
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
    width: "100%",
    height: "100%",
  },
  imageHidden: {
    opacity: 0,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
