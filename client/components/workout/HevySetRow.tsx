import React, { useCallback, useEffect, useRef, useState, useMemo} from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  Animated,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { HEVY } from "@/constants/hevyLayout";
import { Colors, FontFamily, BorderRadius, plateColor, loadTier } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import type { SetData } from "@/lib/storage";
import { repsMeetsTarget } from "@/lib/coachHelpers";
import {
  clampAndFormatReps,
  clampAndFormatWeightExact,
} from "@/lib/activeWorkoutSetFormat";

// 1 kg step so the +/- buttons reach whole-kilo values (dumbbells come in
// kilo increments). 2.5 kg jumps always landed on odd values like 32.5 and
// couldn't hit 32/33. Exact/half-kg weights are still enterable by typing.
const WEIGHT_STEP_KG = 1;

// Chalk & Iron: committed dark, so the static dark palette is used directly.
const C = Colors.dark;
const ROW_SEPARATOR = C.hairline;
const CELL_TEXT = C.chalk;
const LOG_CHECK_BORDER = C.hairlineStrong;
// Completing a set fills the box with chalk (the primary "done" mark), not a
// green tick — colour in this identity is reserved for load, not status.
const DONE_FILL = C.chalk;
const FIELD_ALERT_BG = "rgba(203, 58, 44, 0.30)"; // plate-heavy wash
// 0.045 was effectively invisible against the card, so "which set am I on?"
// had no answer other than the editor appearing somewhere below. The left
// spine cannot carry this — it is the plate colour and already encodes load.
const ACTIVE_ROW_BG = "rgba(236,233,225,0.13)";

type SetRating = "green" | "yellow" | "red" | null;

export type SetFieldValidation = {
  repsInvalid: boolean;
  weightInvalid: boolean;
};

export function validateSetFields(
  setData: Pick<SetData, "weight" | "reps">,
  isBodyweight: boolean,
): SetFieldValidation {
  const repsNum = parseInt(String(setData.reps).replace(/\D/g, ""), 10) || 0;
  const weightNum = parseFloat(String(setData.weight).replace(",", ".")) || 0;
  const repsInvalid = !setData.reps.trim() || repsNum <= 0;
  const weightInvalid =
    !isBodyweight && (!setData.weight.trim() || weightNum <= 0);
  return { repsInvalid, weightInvalid };
}

function useFieldAlertAnimation() {
  const translateX = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const trigger = useCallback(() => {
    translateX.setValue(0);
    pulse.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 8,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -8,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 5,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -5,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 45,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 120,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 280,
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [pulse, translateX]);

  const backgroundColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", FIELD_ALERT_BG],
  });

  return { translateX, backgroundColor, trigger };
}

type FieldAlertCellProps = {
  children: React.ReactNode;
  alertRef: React.MutableRefObject<(() => void) | null>;
  style?: object;
};

function FieldAlertCell({ children, alertRef, style }: FieldAlertCellProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { translateX, backgroundColor, trigger } = useFieldAlertAnimation();

  useEffect(() => {
    alertRef.current = trigger;
    return () => {
      alertRef.current = null;
    };
  }, [alertRef, trigger]);

  return (
    <Animated.View style={[styles.alertCellWrap, { backgroundColor }, style]}>
      <Animated.View style={{ transform: [{ translateX }], width: "100%" }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

type LastSet = { weight: string; reps: string; rating: SetRating } | null;

export type HevySetRowProps = {
  setIndex: number;
  setData: SetData;
  lastWeekData: LastSet;
  isActive: boolean;
  isBodyweight: boolean;
  suppressBottomBorder?: boolean;
  targetReps?: string;
  /** True when this completed set is a new personal record for the exercise. */
  isPR?: boolean;
  /** Isometric hold — the reps field represents seconds, not reps. */
  isHold?: boolean;
  onActivate?: () => void;
  /** Cycles the set between a working set and a warm-up set. */
  onToggleWarmup?: () => void;
  onUpdate: (data: Partial<SetData>) => void;
  onComplete: (payload: {
    rating: SetRating;
    reps: number;
    targetMet: boolean;
  }) => void;
};

function formatPrevious(last: LastSet, bodyweight: boolean): string {
  if (!last) return "—";
  const reps = last.reps?.trim();
  if (bodyweight) {
    return reps ? `${reps}` : "—";
  }
  const weight = last.weight?.trim();
  if (weight && reps) return `${weight} × ${reps}`;
  if (reps) return reps;
  return "—";
}

export function HevySetGridHeader({
  isBodyweight,
  isHold,
}: {
  isBodyweight: boolean;
  isHold?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={[styles.row, styles.headerRow]}>
      <View style={styles.colSet}>
        <Text style={styles.headerLabel}>SET</Text>
      </View>
      <View style={styles.colPrev}>
        <Text style={styles.headerLabel}>PREV</Text>
      </View>
      {!isBodyweight ? (
        <View style={styles.colWeight}>
          <Text style={styles.headerLabel}>KG</Text>
        </View>
      ) : null}
      <View style={[styles.colReps, isBodyweight && styles.colRepsWide]}>
        <Text style={styles.headerLabel}>{isHold ? "SEK." : "REPS"}</Text>
      </View>
      <View style={styles.colCheck}>
        <Text style={styles.headerLabel}> </Text>
      </View>
    </View>
  );
}

/**
 * Press-and-hold repeat for a stepper button: one immediate step on press,
 * then (after a short delay so quick taps stay single steps) repeats at a
 * moderate rate, accelerating after ~1.2s of holding. Without this, reaching
 * a heavy weight (e.g. 150kg on a deadlift) meant 100+ individual taps.
 */
function useHoldToRepeat(onStep: (dir: 1 | -1) => void) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelerateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (accelerateRef.current) {
      clearTimeout(accelerateRef.current);
      accelerateRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const start = useCallback(
    (dir: 1 | -1) => {
      onStep(dir);
      clear();
      // Timings are tuned for the real job: getting from 0 to a working weight
      // like 100-150 kg in 1 kg steps without lifting a thumb. Reaching the fast
      // tier sooner is what makes that bearable (~3.5 s to 100 kg); the parent's
      // autosave is debounced, so the tick rate costs nothing on disk.
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => onStep(dir), 80);
        accelerateRef.current = setTimeout(() => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => onStep(dir), 25);
        }, 800);
      }, 350);
    },
    [onStep, clear],
  );

  return { start, stop: clear };
}

/** One labelled editor: [ − ] [ tap-to-type field ] [ + ]. */
function StepperField({
  label,
  value,
  decimal,
  onChangeText,
  onCommit,
  onStep,
  testID,
}: {
  label: string;
  value: string;
  decimal?: boolean;
  onChangeText: (t: string) => void;
  onCommit: () => void;
  onStep: (dir: 1 | -1) => void;
  testID?: string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const hold = useHoldToRepeat(onStep);
  return (
    <View style={styles.stepField}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable
          onPressIn={() => hold.start(-1)}
          onPressOut={hold.stop}
          hitSlop={8}
          style={styles.stepBtn}
          testID={testID ? `${testID}-minus` : undefined}
        >
          <Feather name="minus" size={18} color={CELL_TEXT} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onEndEditing={onCommit}
          onBlur={onCommit}
          placeholder="0"
          placeholderTextColor={theme.chalkFaint}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          selectTextOnFocus
          returnKeyType="done"
          style={styles.stepInput}
          testID={testID}
        />
        <Pressable
          onPressIn={() => hold.start(1)}
          onPressOut={hold.stop}
          hitSlop={8}
          style={styles.stepBtn}
          testID={testID ? `${testID}-plus` : undefined}
        >
          <Feather name="plus" size={18} color={CELL_TEXT} />
        </Pressable>
      </View>
    </View>
  );
}

function HevySetEditor({
  isBodyweight,
  isHold,
  draftWeight,
  draftReps,
  onChangeWeight,
  onChangeReps,
  onCommitWeight,
  onCommitReps,
  onStepWeight,
  onStepReps,
  setIndex,
}: {
  isBodyweight: boolean;
  isHold?: boolean;
  draftWeight: string;
  draftReps: string;
  onChangeWeight: (t: string) => void;
  onChangeReps: (t: string) => void;
  onCommitWeight: () => void;
  onCommitReps: () => void;
  onStepWeight: (dir: 1 | -1) => void;
  onStepReps: (dir: 1 | -1) => void;
  setIndex: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.editorPanel}>
      {!isBodyweight ? (
        <StepperField
          label="KG"
          value={draftWeight}
          decimal
          onChangeText={onChangeWeight}
          onCommit={onCommitWeight}
          onStep={onStepWeight}
          testID={`step-weight-${setIndex}`}
        />
      ) : null}
      <StepperField
        label={isHold ? "SEK." : "WDH."}
        value={draftReps}
        onChangeText={onChangeReps}
        onCommit={onCommitReps}
        onStep={onStepReps}
        testID={`step-reps-${setIndex}`}
      />
    </View>
  );
}

export function HevySetRow({
  setIndex,
  setData,
  lastWeekData,
  isActive,
  isBodyweight,
  suppressBottomBorder,
  targetReps,
  isPR,
  onActivate,
  onToggleWarmup,
  onUpdate,
  onComplete,
}: HevySetRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isWarmup = setData.setType === "warmup";
  const weightAlertRef = useRef<(() => void) | null>(null);
  const repsAlertRef = useRef<(() => void) | null>(null);
  const { t } = useTranslation();

  // Tap-to-type: precise numeric entry as an alternative to the slider
  // (sliders alone make exact values like 42.5 kg awkward). iOS only —
  // Android keeps the slider. Editing is only offered on the active row.
  const promptEdit = useCallback(
    (field: "weight" | "reps") => {
      if (Platform.OS !== "ios" || setData.completed) return;
      const isWeight = field === "weight";
      const commit = (text?: string) => {
        if (text == null) return;
        onUpdate(
          isWeight
            ? { weight: clampAndFormatWeightExact(text) }
            : { reps: clampAndFormatReps(text) },
        );
      };
      Alert.prompt(
        t(isWeight ? "activeWorkout.editWeightTitle" : "activeWorkout.editRepsTitle"),
        undefined,
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.ok"), onPress: commit },
        ],
        "plain-text",
        isWeight ? setData.weight : setData.reps,
        isWeight ? "decimal-pad" : "number-pad",
      );
    },
    [onUpdate, setData.completed, setData.weight, setData.reps, t],
  );

  const previousLabel = formatPrevious(lastWeekData, isBodyweight);
  const repsNum = parseInt(String(setData.reps).replace(/\D/g, ""), 10) || 0;
  const weightNum = parseFloat(String(setData.weight).replace(",", ".")) || 0;
  const weightDisplay = setData.weight?.trim() ? setData.weight : "—";
  const repsDisplay = setData.reps?.trim() ? setData.reps : "—";

  // Plate spine: the row's left edge is coloured by load. Warm-ups read as the
  // light plate; sets with no weight yet stay neutral until a weight is entered.
  const spineColor = isWarmup
    ? C.plateLight
    : weightNum > 0
      ? plateColor(loadTier(weightNum))
      : C.hairlineStrong;

  const handleCheck = () => {
    // Tapping a completed set un-checks it and reactivates it for editing —
    // an accidental check used to freeze the row with no way back.
    if (setData.completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdate({ completed: false, rating: null });
      onActivate?.();
      return;
    }

    // Completing a set never requires weight/reps — a bodyweight move, a set
    // you just want to tick off, or doing 3 of 4 sets are all valid. Empty
    // values simply contribute 0 volume and don't count as a PR.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const rating: SetRating = "yellow";
    onUpdate({ rating, completed: true });
    onComplete({
      rating,
      reps: repsNum,
      targetMet: repsMeetsTarget(repsNum, targetReps),
    });
  };

  const rowMuted = !isActive && !setData.completed;

  return (
    <Pressable
      onPress={() => {
        if (!setData.completed) onActivate?.();
      }}
      style={[
        styles.row,
        { borderLeftWidth: 3, borderLeftColor: spineColor },
        isActive && !setData.completed && styles.rowActive,
        rowMuted && styles.rowMuted,
        setData.completed && styles.rowCompleted,
        suppressBottomBorder && styles.rowNoBottomBorder,
      ]}
      testID={`set-row-${setIndex}`}
    >
      <View style={styles.colSet}>
        <Pressable
          onPress={onToggleWarmup}
          disabled={setData.completed}
          hitSlop={8}
          testID={`button-set-type-${setIndex}`}
          accessibilityLabel={t("activeWorkout.toggleWarmupA11y")}
        >
          {isWarmup ? (
            <Text style={styles.warmupBadge}>W</Text>
          ) : (
            <Text
              style={[
                styles.setNum,
                rowMuted && styles.textMuted,
                isActive && !setData.completed && styles.setNumActive,
              ]}
            >
              {setIndex + 1}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.colPrev}>
        {isPR ? (
          <View style={styles.prBadge}>
            <Feather name="award" size={11} color={C.iron} />
            <Text style={styles.prBadgeText}>PR</Text>
          </View>
        ) : (
          <Text
            style={[styles.prevText, rowMuted && styles.textMuted]}
            numberOfLines={1}
          >
            {previousLabel}
          </Text>
        )}
      </View>

      {!isBodyweight ? (
        <View style={styles.colWeight}>
          <FieldAlertCell alertRef={weightAlertRef}>
            <Pressable
              onPress={() => promptEdit("weight")}
              disabled={!isActive || setData.completed}
              hitSlop={6}
              style={styles.cellPress}
            >
              <Text
                style={[styles.cellValue, rowMuted && styles.textMuted]}
                numberOfLines={1}
              >
                {weightDisplay}
              </Text>
            </Pressable>
          </FieldAlertCell>
        </View>
      ) : null}

      <View style={[styles.colReps, isBodyweight && styles.colRepsWide]}>
        <FieldAlertCell alertRef={repsAlertRef}>
          <Pressable
            onPress={() => promptEdit("reps")}
            disabled={!isActive || setData.completed}
            hitSlop={6}
            style={styles.cellPress}
          >
            <Text
              style={[styles.cellValue, rowMuted && styles.textMuted]}
              numberOfLines={1}
            >
              {repsDisplay}
            </Text>
          </Pressable>
        </FieldAlertCell>
      </View>

      <View style={styles.colCheck}>
        <Pressable
          onPress={handleCheck}
          hitSlop={10}
          style={[
            styles.checkBox,
            setData.completed
              ? styles.checkBoxDone
              : isActive
                ? styles.checkBoxReady
                : styles.checkBoxIdle,
          ]}
          testID={`button-complete-set-${setIndex}`}
          accessibilityRole="checkbox"
          accessibilityLabel={t("activeWorkout.toggleSetA11y")}
          accessibilityState={{ checked: setData.completed }}
        >
          <Feather
            name="check"
            size={setData.completed ? 16 : 14}
            color={
              setData.completed
                ? C.iron
                : isActive
                  ? C.chalkDim
                  : C.chalkFaint
            }
            style={!setData.completed ? styles.checkIconIdle : undefined}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

export type HevySetRowWithPrefillProps = HevySetRowProps & {
  progressionWeight?: number | null;
  progressionReps?: number | null;
};

/** Active set: a tap-to-type + stepper editor under the row. Local draft while
 *  typing so keystrokes aren't reformatted mid-entry; commit on blur / stepper. */
export function HevySetRowWithPrefill(props: HevySetRowWithPrefillProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {
    isActive,
    setData,
    lastWeekData,
    isBodyweight,
    progressionWeight,
    progressionReps,
    onUpdate,
  } = props;

  const typingRef = useRef(false);
  const [draft, setDraft] = useState({
    weight: setData.weight,
    reps: setData.reps,
  });

  // Keep the draft in sync with committed data unless the user is mid-edit.
  useEffect(() => {
    if (!typingRef.current) {
      setDraft({ weight: setData.weight, reps: setData.reps });
    }
  }, [setData.weight, setData.reps]);

  // Prefill an empty active set from the recommended progression / last session.
  useEffect(() => {
    if (!isActive || setData.completed) return;
    if (setData.weight !== "" || setData.reps !== "") return;

    if (isBodyweight) {
      const repPrefill =
        progressionReps != null
          ? String(progressionReps)
          : lastWeekData?.reps ?? "";
      if (repPrefill) onUpdate({ reps: repPrefill, weight: "" });
      return;
    }

    if (progressionWeight != null) {
      const repPrefill =
        progressionReps != null
          ? String(progressionReps)
          : lastWeekData?.reps ?? "";
      onUpdate({ weight: String(progressionWeight), reps: repPrefill });
    } else if (lastWeekData) {
      onUpdate({ weight: lastWeekData.weight, reps: lastWeekData.reps });
    }
  }, [isActive]);

  const showEditor = isActive && !setData.completed;

  const commitWeight = useCallback(() => {
    typingRef.current = false;
    const formatted = clampAndFormatWeightExact(draft.weight);
    setDraft((d) => ({ ...d, weight: formatted }));
    onUpdate({ weight: formatted });
  }, [draft.weight, onUpdate]);

  const commitReps = useCallback(() => {
    typingRef.current = false;
    const formatted = clampAndFormatReps(draft.reps);
    setDraft((d) => ({ ...d, reps: formatted }));
    onUpdate({ reps: formatted });
  }, [draft.reps, onUpdate]);

  // Hold-to-repeat drives these from an interval that captures the callback ONCE
  // at press time. Reading `draft` out of the closure therefore recomputes from
  // the same stale base on every tick: the number freezes after the first step
  // while the haptics keep firing. Mirror the draft into a ref and advance it
  // synchronously, so each tick builds on what the previous tick just wrote —
  // independent of React's commit timing.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const stepWeight = useCallback(
    (dir: 1 | -1) => {
      const current = draftRef.current.weight;
      const base = parseFloat(String(current).replace(",", ".")) || 0;
      const next = Math.max(0, base + dir * WEIGHT_STEP_KG);
      const formatted = clampAndFormatWeightExact(String(next));
      // At the floor (or a clamped ceiling) nothing moves — don't buzz for a
      // step that didn't happen.
      if (formatted === current) return;
      draftRef.current = { ...draftRef.current, weight: formatted };
      typingRef.current = false;
      setDraft((d) => ({ ...d, weight: formatted }));
      onUpdate({ weight: formatted });
      Haptics.selectionAsync();
    },
    [onUpdate],
  );

  const stepReps = useCallback(
    (dir: 1 | -1) => {
      const current = draftRef.current.reps;
      const base = parseInt(String(current).replace(/\D/g, ""), 10) || 0;
      const next = Math.max(0, base + dir);
      const formatted = clampAndFormatReps(String(next));
      if (formatted === current) return;
      draftRef.current = { ...draftRef.current, reps: formatted };
      typingRef.current = false;
      setDraft((d) => ({ ...d, reps: formatted }));
      onUpdate({ reps: formatted });
      Haptics.selectionAsync();
    },
    [onUpdate],
  );

  const displaySet: SetData = {
    ...setData,
    weight: showEditor ? draft.weight : setData.weight,
    reps: showEditor ? draft.reps : setData.reps,
  };

  return (
    <View style={[styles.setBlock, showEditor && styles.setBlockActive]}>
      <HevySetRow {...props} setData={displaySet} suppressBottomBorder={showEditor} />
      {showEditor ? (
        <HevySetEditor
          setIndex={props.setIndex}
          isBodyweight={isBodyweight}
          isHold={props.isHold}
          draftWeight={draft.weight}
          draftReps={draft.reps}
          onChangeWeight={(t) => {
            typingRef.current = true;
            setDraft((d) => ({ ...d, weight: t }));
          }}
          onChangeReps={(t) => {
            typingRef.current = true;
            setDraft((d) => ({ ...d, reps: t }));
          }}
          onCommitWeight={commitWeight}
          onCommitReps={commitReps}
          onStepWeight={stepWeight}
          onStepReps={stepReps}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  setBlock: {
    backgroundColor: c.ironElevated2,
  },
  setBlockActive: {
    // The row you are on and the kg/reps editor under it are one unit — the set
    // being worked. Until now they were two loose pieces stacked on the same
    // flat card, so nothing said they belonged together. A frame binds them.
    borderWidth: 1.5,
    borderColor: C.chalkDim,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginHorizontal: 6,
    marginVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: HEVY.pad,
    backgroundColor: c.ironElevated2,
    borderBottomWidth: 0.5,
    borderBottomColor: ROW_SEPARATOR,
    minHeight: 36,
  },
  rowActive: {
    backgroundColor: ACTIVE_ROW_BG,
  },
  rowNoBottomBorder: {
    borderBottomWidth: 0,
  },
  headerRow: {
    backgroundColor: c.iron,
    paddingVertical: 5,
    minHeight: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: ROW_SEPARATOR,
  },
  rowMuted: {
    // Upcoming sets are secondary to the active row, but they still have to be
    // readable at arm's length in a gym: 0.55 buried them, and 0.82 still left
    // the set number and the rep target grey-on-grey. The active row is already
    // distinguished by its own tint and left spine, so this does not need to
    // carry the hierarchy on its own.
    opacity: 0.9,
  },
  rowCompleted: {
    opacity: 0.95,
  },
  colSet: {
    width: "10%",
    alignItems: "center",
    justifyContent: "center",
  },
  colPrev: {
    width: "25%",
    paddingRight: 4,
    justifyContent: "center",
  },
  colWeight: {
    width: "25%",
    justifyContent: "center",
    alignItems: "center",
  },
  colReps: {
    width: "25%",
    justifyContent: "center",
    alignItems: "center",
  },
  colRepsWide: {
    width: "50%",
  },
  colCheck: {
    width: "15%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: FontFamily.displaySemi,
    // These name the columns you read on every single set, so they carry the
    // full ink colour. The recessed header band behind them already separates
    // them from the rows — dimming the text as well made the whole grid look
    // switched off.
    color: CELL_TEXT,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  setNum: {
    fontSize: 15,
    fontFamily: FontFamily.mono,
    color: CELL_TEXT,
    textAlign: "center",
  },
  setNumActive: {
    color: C.onChalk,
    backgroundColor: C.chalk,
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontWeight: "700",
  },
  prevText: {
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: c.chalkDim,
  },
  warmupBadge: {
    fontSize: 13,
    fontFamily: FontFamily.display,
    color: C.plateMedium,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: C.plateMedium,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.display,
    color: C.iron,
    letterSpacing: 0.4,
  },
  cellPress: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cellValue: {
    fontSize: 16,
    fontFamily: FontFamily.mono,
    color: CELL_TEXT,
    textAlign: "center",
    width: "100%",
  },
  cellValueAlert: {
    color: C.plateHeavy,
  },
  alertCellWrap: {
    width: "100%",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  textMuted: {
    // Upcoming sets used chalkFaint, the weakest value in the system: roughly
    // 2.3:1 against the card, i.e. below the readable threshold for text this
    // size — which is what made the screen feel "too dark" even though the
    // active row was fine. chalkDim keeps them clearly secondary while staying
    // legible at arm's length.
    color: c.chalkDim,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.ironElevated2,
  },
  checkBoxIdle: {
    borderColor: LOG_CHECK_BORDER,
  },
  checkBoxReady: {
    borderColor: LOG_CHECK_BORDER,
    backgroundColor: "rgba(236,233,225,0.06)",
  },
  checkBoxDone: {
    borderColor: DONE_FILL,
    backgroundColor: DONE_FILL,
  },
  checkIconIdle: {
    opacity: 0.5,
  },
  editorPanel: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: HEVY.pad,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: c.ironElevated2,
    borderBottomWidth: 0.5,
    borderBottomColor: ROW_SEPARATOR,
  },
  stepField: {
    flex: 1,
    gap: 4,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: FontFamily.displaySemi,
    letterSpacing: 1.2,
    // These label the field you are actively editing; the faintest value in
    // the system made them look like a disabled caption.
    color: c.chalkDim,
    textAlign: "center",
  },
  stepControls: {
    flexDirection: "row",
    alignItems: "center",
    // This group only ever appears for the ACTIVE set, so it should look live.
    // A 0.08-alpha hairline read as a disabled control.
    borderWidth: 1.5,
    borderColor: C.chalkDim,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: c.ironElevated2,
  },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.ironElevated3,
  },
  stepInput: {
    flex: 1,
    height: 40,
    fontSize: 18,
    fontFamily: FontFamily.mono,
    color: CELL_TEXT,
    textAlign: "center",
    paddingVertical: 0,
    // Recessed well between two raised buttons: the field was previously the
    // same tone as the card and therefore darker than the +/- buttons flanking
    // it, which read as "the buttons are the control, this gap is nothing".
    backgroundColor: c.iron,
  },
});
