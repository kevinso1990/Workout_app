import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { fetchExerciseGif } from "@/services/exerciseApi";
import { getExerciseImageUrl } from "@/lib/exerciseImages";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";
import { ExerciseGifSkeleton } from "@/components/workout/ExerciseGifSkeleton";

type ExerciseDbThumbProps = {
  exerciseName: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
};

/** Small animated ExerciseDB GIF for list rows (with skeleton while loading). */
export function ExerciseDbThumb({
  exerciseName,
  style,
  onPress,
  testID,
}: ExerciseDbThumbProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const [gifFailed, setGifFailed] = useState(false);
  const requestRef = useRef(0);

  // Static GitHub-CDN still image (no API key needed). Used as a reliable
  // fallback when the RapidAPI GIF is missing, unconfigured, or fails to load.
  const staticUrl = useMemo(
    () => getExerciseImageUrl(exerciseName),
    [exerciseName],
  );

  useEffect(() => {
    const requestId = ++requestRef.current;
    setFetchDone(false);
    setImageReady(false);
    setGifFailed(false);
    setGifUrl(null);

    void (async () => {
      const url = await fetchExerciseGif(exerciseName);
      if (requestRef.current !== requestId) return;
      setGifUrl(url);
      setFetchDone(true);
      // If neither the animated GIF nor a static fallback exists, stop the
      // skeleton immediately so we don't spin forever.
      if (!url && !getExerciseImageUrl(exerciseName)) setImageReady(true);
    })();

    return () => {
      requestRef.current += 1;
    };
  }, [exerciseName]);

  // Prefer the animated GIF; fall back to the static image if it's missing or
  // errored. Only wait on the network fetch when there's no static image.
  const animatedUri = gifUrl && !gifFailed ? gifUrl : null;
  const displayUri = animatedUri ?? staticUrl;
  const showSkeleton =
    (!fetchDone && !staticUrl) || (displayUri !== null && !imageReady);

  const content = (
    <>
      {showSkeleton ? (
        <ExerciseGifSkeleton style={StyleSheet.absoluteFill} />
      ) : null}
      {displayUri ? (
        <ExerciseGifImage
          uri={displayUri}
          style={[styles.image, !imageReady && styles.imageHidden]}
          contentFit="cover"
          recyclingKey={`${exerciseName}-thumb-${displayUri}`}
          onLoad={() => setImageReady(true)}
          onError={() => {
            // GIF failed — drop to the static image if we have one.
            if (animatedUri && staticUrl) {
              setGifFailed(true);
              setImageReady(false);
            } else {
              setImageReady(true);
            }
          }}
        />
      ) : fetchDone ? (
        // No animation and no static image for this exercise (e.g. custom or
        // newly-added moves like Dead Hang) — show a neutral dumbbell glyph so
        // the tile looks intentional instead of blank or leaking a config hint.
        <View style={styles.placeholderWrap}>
          <MaterialCommunityIcons name="dumbbell" size={22} color="#B0B0B8" />
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.frame, style]}
        testID={testID}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.frame, style]} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageHidden: {
    opacity: 0,
  },
  placeholderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
  },
});
