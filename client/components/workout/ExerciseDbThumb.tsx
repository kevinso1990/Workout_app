import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { EXERCISEDB_KEY_HINT, isExerciseDbConfigured } from "@/lib/rapidApiConfig";
import { fetchExerciseGif } from "@/services/exerciseApi";
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
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    setFetchDone(false);
    setImageReady(false);
    setGifUrl(null);

    void (async () => {
      const url = await fetchExerciseGif(exerciseName);
      if (requestRef.current !== requestId) return;
      setGifUrl(url);
      setFetchDone(true);
      if (!url) setImageReady(true);
    })();

    return () => {
      requestRef.current += 1;
    };
  }, [exerciseName]);

  const showSkeleton = !fetchDone || (gifUrl !== null && !imageReady);

  const content = (
    <>
      {showSkeleton ? (
        <ExerciseGifSkeleton style={StyleSheet.absoluteFill} />
      ) : null}
      {gifUrl ? (
        <ExerciseGifImage
          uri={gifUrl}
          style={[styles.image, !imageReady && styles.imageHidden]}
          contentFit="cover"
          recyclingKey={`${exerciseName}-thumb-${gifUrl}`}
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(true)}
        />
      ) : fetchDone && !isExerciseDbConfigured() ? (
        <View style={styles.hintWrap}>
          <Text style={styles.hintText} numberOfLines={3}>
            {EXERCISEDB_KEY_HINT}
          </Text>
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
  hintWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    backgroundColor: "#F2F2F7",
  },
  hintText: {
    fontSize: 8,
    lineHeight: 10,
    textAlign: "center",
    color: "#8E8E93",
  },
});
