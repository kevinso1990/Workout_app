import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { ExerciseDbThumb } from "@/components/workout/ExerciseDbThumb";

type Props = {
  exerciseName: string;
  style: StyleProp<ViewStyle>;
  iconColor?: string;
  testID?: string;
  onPress?: () => void;
};

/** Animated ExerciseDB thumbnail for exercise lists. */
export function ServerExerciseThumb({
  exerciseName,
  style,
  testID,
  onPress,
}: Props) {
  return (
    <ExerciseDbThumb
      exerciseName={exerciseName}
      style={style}
      testID={testID}
      onPress={onPress}
    />
  );
}
