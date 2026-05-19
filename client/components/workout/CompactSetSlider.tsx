import React, { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, View, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { HEVY } from "@/constants/hevyLayout";
import { Colors } from "@/constants/theme";

type CompactSetSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  formatValue: (n: number) => string;
  onValueChange: (value: number) => void;
  /** Fired when the user touches the thumb — keep native view mounted until end. */
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  testID?: string;
  large?: boolean;
};

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

/**
 * RNCSlider + Fabric can SIGSEGV if the parent unmounts the slider while
 * `onSlidingComplete` is still dispatching (TestFlight crash in EventDispatcher).
 * We keep draft state locally during a gesture and commit to the parent only
 * after the native touch cycle finishes.
 */
export const CompactSetSlider = React.memo(function CompactSetSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  formatValue,
  onValueChange,
  onInteractionStart,
  onInteractionEnd,
  testID,
  large = false,
}: CompactSetSliderProps) {
  const mountedRef = useRef(true);
  const draggingRef = useRef(false);
  const committedRef = useRef(snap(value, step));

  const [draft, setDraft] = useState(() => snap(value, step));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const snapped = snap(value, step);
    committedRef.current = snapped;
    if (!draggingRef.current) {
      setDraft(snapped);
    }
  }, [value, step]);

  const displayValue = draggingRef.current ? draft : snap(value, step);

  const beginInteraction = useCallback(() => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      onInteractionStart?.();
    }
  }, [onInteractionStart]);

  const finishInteraction = useCallback(
    (raw: number) => {
      const next = snap(raw, step);
      draggingRef.current = false;
      setDraft(next);
      onInteractionEnd?.();

      InteractionManager.runAfterInteractions(() => {
        if (!mountedRef.current) return;
        if (committedRef.current === next) return;
        committedRef.current = next;
        onValueChange(next);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      });
    },
    [onInteractionEnd, onValueChange, step],
  );

  const handleChange = useCallback(
    (raw: number) => {
      beginInteraction();
      setDraft(snap(raw, step));
    },
    [beginInteraction, step],
  );

  const handleStart = useCallback(() => {
    beginInteraction();
  }, [beginInteraction]);

  const handleComplete = useCallback(
    (raw: number) => {
      finishInteraction(raw);
    },
    [finishInteraction],
  );

  return (
    <View style={[styles.wrap, large && styles.wrapLarge]}>
      <View style={styles.labelRow}>
        <ThemedText style={[styles.label, large && styles.labelLarge]}>{label}</ThemedText>
        <ThemedText style={[styles.valueText, large && styles.valueTextLarge]}>
          {formatValue(displayValue)}
          {unit}
        </ThemedText>
      </View>
      <Slider
        style={[styles.slider, large && styles.sliderLarge]}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={displayValue}
        onSlidingStart={handleStart}
        onValueChange={handleChange}
        onSlidingComplete={handleComplete}
        minimumTrackTintColor={Colors.light.primary}
        maximumTrackTintColor={HEVY.separator}
        thumbTintColor={Colors.light.primary}
        testID={testID}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: HEVY.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  valueText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: HEVY.textPrimary,
  },
  slider: {
    width: "100%",
    height: 28,
  },
  wrapLarge: {
    flex: undefined,
    width: "100%",
    marginBottom: 8,
  },
  labelLarge: {
    fontSize: 13,
  },
  valueTextLarge: {
    fontSize: 22,
  },
  sliderLarge: {
    height: 44,
  },
});
