import React, { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";

import { Colors } from "@/constants/theme";
import { HEVY } from "@/constants/hevyLayout";

type MicroSetSliderProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  onDraft: (value: number) => void;
  onCommit: (value: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  testID?: string;
};

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

/** Ultra-low profile slider — local draft during drag, parent commit after touch ends. */
export const MicroSetSlider = React.memo(function MicroSetSlider({
  value,
  min,
  max,
  step,
  onDraft,
  onCommit,
  onInteractionStart,
  onInteractionEnd,
  testID,
}: MicroSetSliderProps) {
  const mountedRef = useRef(true);
  const draggingRef = useRef(false);
  const [draft, setDraft] = useState(() => snap(value, step));
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!draggingRef.current) {
      setDraft(snap(value, step));
    }
  }, [value, step]);

  const display = isDragging ? draft : snap(value, step);

  const begin = useCallback(() => {
    if (!draggingRef.current) {
      draggingRef.current = true;
      setIsDragging(true);
      onInteractionStart?.();
    }
  }, [onInteractionStart]);

  const finish = useCallback(
    (raw: number) => {
      const next = snap(raw, step);
      draggingRef.current = false;
      setIsDragging(false);
      setDraft(next);
      onInteractionEnd?.();

      InteractionManager.runAfterInteractions(() => {
        if (!mountedRef.current) return;
        onCommit(next);
      });
    },
    [onCommit, onInteractionEnd, step],
  );

  const handleChange = useCallback(
    (raw: number) => {
      const next = snap(raw, step);
      begin();
      setDraft(next);
      onDraft(next);
    },
    [begin, onDraft, step],
  );

  return (
    <View style={styles.wrap}>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={display}
        onSlidingStart={begin}
        onValueChange={handleChange}
        onSlidingComplete={finish}
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
    justifyContent: "center",
  },
  slider: {
    width: "100%",
    height: 22,
  },
});
