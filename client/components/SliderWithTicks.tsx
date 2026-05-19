import React, { useMemo, useState, useCallback } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import Slider from "@react-native-community/slider";

import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/theme";

const THUMB_INSET = 14;

function snapToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function formatTickLabel(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value));
  const snapped = snapToStep(value, step);
  return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
}

function buildLabeledTicks(min: number, max: number, step: number, maxLabels = 7): number[] {
  const values: number[] = [];
  for (let v = min; v <= max + step * 0.01; v += step) {
    values.push(snapToStep(v, step));
  }
  if (values.length <= maxLabels) return values;
  const stride = Math.max(1, Math.ceil((values.length - 1) / (maxLabels - 1)));
  const picked: number[] = [];
  for (let i = 0; i < values.length; i += stride) {
    picked.push(values[i]);
  }
  const last = values[values.length - 1];
  if (picked[picked.length - 1] !== last) picked.push(last);
  return picked;
}

type SliderWithTicksProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: () => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
  labelColor: string;
  tickColor: string;
  testID?: string;
};

export function SliderWithTicks({
  min,
  max,
  step,
  value,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  labelColor,
  tickColor,
  testID,
}: SliderWithTicksProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const labeledTicks = useMemo(
    () => buildLabeledTicks(min, max, step),
    [min, max, step],
  );
  const allTicks = useMemo(() => {
    const t: number[] = [];
    for (let v = min; v <= max + step * 0.01; v += step) {
      t.push(snapToStep(v, step));
    }
    return t;
  }, [min, max, step]);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const positionFor = (tickValue: number) => {
    if (trackWidth <= 0 || max <= min) return 0;
    const usable = Math.max(0, trackWidth - THUMB_INSET * 2);
    const ratio = (tickValue - min) / (max - min);
    return THUMB_INSET + ratio * usable;
  };

  const handleChange = (raw: number) => {
    onValueChange(snapToStep(raw, step));
  };

  return (
    <View style={styles.root}>
      <View onLayout={onTrackLayout}>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onValueChange={handleChange}
          onSlidingComplete={onSlidingComplete}
          minimumTrackTintColor={minimumTrackTintColor}
          maximumTrackTintColor={maximumTrackTintColor}
          thumbTintColor={thumbTintColor}
          testID={testID}
        />
      </View>
      {trackWidth > 0 ? (
        <View style={[styles.tickRail, { width: trackWidth }]}>
          {allTicks.map((tick) => {
            const left = positionFor(tick);
            const showLabel = labeledTicks.some(
              (t) => Math.abs(t - tick) < step * 0.01,
            );
            return (
              <View
                key={`tick-${tick}`}
                style={[styles.tickColumn, { left, transform: [{ translateX: -0.5 }] }]}
              >
                <View style={[styles.tickMark, { backgroundColor: tickColor }]} />
                {showLabel ? (
                  <ThemedText
                    style={[styles.tickLabel, { color: labelColor }]}
                    numberOfLines={1}
                  >
                    {formatTickLabel(tick, step)}
                  </ThemedText>
                ) : (
                  <View style={styles.tickLabelSpacer} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  tickRail: {
    position: "relative",
    height: 28,
    marginTop: -Spacing.xs,
  },
  tickColumn: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    width: 1,
  },
  tickMark: {
    width: 1,
    height: 6,
    opacity: 0.45,
  },
  tickLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    minWidth: 28,
    textAlign: "center",
    transform: [{ translateX: -13 }],
  },
  tickLabelSpacer: {
    height: 14,
  },
});
