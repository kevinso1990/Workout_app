import React, { useCallback, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Slider from "@react-native-community/slider";

type PlatformRangeSliderProps = {
  minimumValue: number;
  maximumValue: number;
  step: number;
  value: number;
  onSlidingStart?: () => void;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor?: string;
  thumbTintColor: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Mobile Safari often ignores touch on @react-native-community/slider.
 * On web we use a native `<input type="range">` with per-instance CSS vars
 * so weight/reps sliders never share track styling.
 */
export function PlatformRangeSlider({
  minimumValue: min,
  maximumValue: max,
  step,
  value,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  style,
  testID,
}: PlatformRangeSliderProps) {
  const inputIdRef = useRef(`fitplan-range-${Math.random().toString(36).slice(2, 11)}`);
  const draggingRef = useRef(false);

  const handleWebStart = useCallback(() => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      onSlidingStart?.();
    }
  }, [onSlidingStart]);

  const handleWebChange = useCallback(
    (raw: string) => {
      handleWebStart();
      onValueChange(Number(raw));
    },
    [handleWebStart, onValueChange],
  );

  const handleWebEnd = useCallback(
    (raw: string) => {
      draggingRef.current = false;
      onSlidingComplete?.(Number(raw));
    },
    [onSlidingComplete],
  );

  if (Platform.OS === "web") {
    const clamped = Math.min(Math.max(value, min), max);
    const inactive = maximumTrackTintColor ?? "#E5E5EA";
    const fillPct = `${((clamped - min) / (max - min || 1)) * 100}%`;
    const inputId = inputIdRef.current;

    return (
      <View style={[styles.webWrap, style]} testID={testID}>
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onPointerDown={handleWebStart}
          onTouchStart={handleWebStart}
          onChange={(e) => handleWebChange(e.currentTarget.value)}
          onInput={(e) => handleWebChange(e.currentTarget.value)}
          onPointerUp={(e) => handleWebEnd(e.currentTarget.value)}
          onTouchEnd={(e) => handleWebEnd(e.currentTarget.value)}
          style={{
            width: "100%",
            height: 44,
            margin: 0,
            padding: 0,
            touchAction: "none",
            WebkitAppearance: "none",
            appearance: "none",
            background: "transparent",
            cursor: "pointer",
            // Per-slider CSS vars — pseudo-elements read from the input element.
            ["--fitplan-track-active" as string]: minimumTrackTintColor,
            ["--fitplan-track-inactive" as string]: inactive,
            ["--fitplan-track-fill" as string]: fillPct,
            ["--fitplan-thumb" as string]: thumbTintColor,
          }}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clamped}
        />
        <style>{`
          #${inputId}::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 22px;
            height: 22px;
            border-radius: 11px;
            background: var(--fitplan-thumb);
            border: none;
            margin-top: -9px;
          }
          #${inputId}::-webkit-slider-runnable-track {
            height: 4px;
            border-radius: 2px;
            background: linear-gradient(
              to right,
              var(--fitplan-track-active) 0%,
              var(--fitplan-track-active) var(--fitplan-track-fill),
              var(--fitplan-track-inactive) var(--fitplan-track-fill),
              var(--fitplan-track-inactive) 100%
            );
          }
          #${inputId}::-moz-range-thumb {
            width: 22px;
            height: 22px;
            border-radius: 11px;
            background: var(--fitplan-thumb);
            border: none;
          }
          #${inputId}::-moz-range-track {
            height: 4px;
            border-radius: 2px;
            background: var(--fitplan-track-inactive);
          }
          #${inputId}::-moz-range-progress {
            height: 4px;
            border-radius: 2px;
            background: var(--fitplan-track-active);
          }
        `}</style>
      </View>
    );
  }

  return (
    <Slider
      style={style}
      minimumValue={min}
      maximumValue={max}
      step={step}
      value={value}
      onSlidingStart={onSlidingStart}
      onValueChange={onValueChange}
      onSlidingComplete={onSlidingComplete}
      minimumTrackTintColor={minimumTrackTintColor}
      maximumTrackTintColor={maximumTrackTintColor}
      thumbTintColor={thumbTintColor}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  webWrap: {
    width: "100%",
    justifyContent: "center",
    touchAction: "none",
  } as ViewStyle,
});
