import React, { useEffect, useMemo} from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
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
  baseColor,
  pulseColor,
}: ExerciseGifSkeletonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  // Defaults live here rather than in the destructuring above: a default value
  // in the parameter list is evaluated before any hook can run, so it could
  // only ever be a hard-coded dark colour.
  const base = baseColor ?? theme.ironElevated2;
  const pulse = pulseColor ?? theme.ironElevated3;
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
    <View style={[styles.container, { backgroundColor: base }, style]}>
      <Animated.View style={[styles.pulse, { backgroundColor: pulse }, pulseStyle]} />
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
  },
});
