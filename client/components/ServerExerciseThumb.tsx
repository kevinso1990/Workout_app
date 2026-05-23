import React from "react";
import { Image, View, StyleProp, ViewStyle, ImageStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getExerciseImageUrl } from "@/lib/exerciseImages";

type Props = {
  exerciseName: string;
  style: StyleProp<ViewStyle>;
  iconColor: string;
  testID?: string;
};

/** Static list thumbnail — no animated GIF (saves API calls & battery). */
export function ServerExerciseThumb({ exerciseName, style, iconColor, testID }: Props) {
  const staticUri = getExerciseImageUrl(exerciseName);

  if (staticUri) {
    return (
      <Image
        source={{ uri: staticUri }}
        style={style as StyleProp<ImageStyle>}
        resizeMode="cover"
        testID={testID}
      />
    );
  }

  return (
    <View
      style={[style, { alignItems: "center", justifyContent: "center" }]}
      testID={testID}
    >
      <Feather name="activity" size={22} color={iconColor} />
    </View>
  );
}
