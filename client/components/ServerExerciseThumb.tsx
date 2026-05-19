import React, { useEffect, useState } from "react";
import { View, StyleProp, ViewStyle, ImageStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ExerciseGifImage } from "@/components/workout/ExerciseGifImage";
import { getExerciseGifThumbUrl } from "@/services/exerciseMedia";
import { fetchExerciseGif } from "@/services/exerciseApi";

type Props = {
  exerciseName: string;
  style: StyleProp<ViewStyle>;
  iconColor: string;
  testID?: string;
};

/**
 * Lazy-loads a small GIF/thumbnail via `GET /api/exercises/gif/:name?resolution=360`.
 */
export function ServerExerciseThumb({ exerciseName, style, iconColor, testID }: Props) {
  const [uri, setUri] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const animated = await fetchExerciseGif(exerciseName);
      if (cancelled) return;
      if (animated) {
        setUri(animated);
        return;
      }
      const thumb = await getExerciseGifThumbUrl(exerciseName);
      if (!cancelled) setUri(thumb);
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  if (uri === undefined) {
    return <View style={style} testID={testID} />;
  }
  if (!uri) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center" }]} testID={testID}>
        <Feather name="activity" size={22} color={iconColor} />
      </View>
    );
  }
  return (
    <ExerciseGifImage
      uri={uri}
      style={style as StyleProp<ImageStyle>}
      contentFit="cover"
      recyclingKey={exerciseName}
      testID={testID}
    />
  );
}
