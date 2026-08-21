import React, { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type ExerciseGifSkeletonProps = {
  style?: StyleProp<ViewStyle>;
  /** Base fill behind the pulse layer */
  baseColor?: string;
  /** Pulsing highlight layer */
  pulseColor?: string;
};

/** Fixed-size pulsing placeholder while an exercise GIF loads. */
export function ExerciseGifSkeleton({
  style,
  baseColor = Colors.dark.ironElevated2,
  pulseColor = Colors.dark.ironElevated3,
}: ExerciseGifSkeletonProps) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={[styles.container, { backgroundColor: baseColor }, style]}>
      <Animated.View style={[styles.pulse, { backgroundColor: pulseColor }, pulseStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
  },
});
