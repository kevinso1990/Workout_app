import React, { useEffect, useRef, useState } from "react";
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
  height = EXERCISE_HERO_GIF_HEIGHT,
  style,
  dark = false,
  onDetailLoaded,
}: ExerciseDbHeroGifProps) {
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
      setResolvedUrl(animated);
      setFetchDone(true);
      onDetailLoadedRef.current?.({
        gifUrl: animated,
        instructions: detail?.instructions ?? [],
      });

      if (!animated) {
        setImageReady(true);
      }
    })();

    return () => {
      requestRef.current += 1;
    };
  }, [exerciseName]);

  const showSkeleton = !fetchDone || (resolvedUrl !== null && !imageReady);
  const skeletonBase = dark ? "#1C1C1E" : "#E8E8ED";
  const skeletonPulse = dark ? "#2C2C2E" : "#F4F4F8";
  const showKeyHint = fetchDone && !resolvedUrl && !isExerciseDbConfigured();

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
          onError={() => setImageReady(true)}
        />
      ) : showKeyHint ? (
        <View style={styles.hintWrap}>
          <Text style={[styles.hintText, dark && styles.hintTextDark]}>
            {EXERCISEDB_KEY_HINT}
          </Text>
        </View>
      ) : fetchDone ? (
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
