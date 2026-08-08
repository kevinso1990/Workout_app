import React, { useCallback, useEffect, useRef, useState } from "react";
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
import type { SetData } from "@/lib/storage";
import { repsMeetsTarget } from "@/lib/coachHelpers";
import {
  clampAndFormatReps,
  clampAndFormatWeightExact,
} from "@/lib/activeWorkoutSetFormat";

/** Plate-friendly weight increment for the +/- steppers. */
const WEIGHT_STEP_KG = 2.5;

const ROW_SEPARATOR = "#E5E5EA";
const CELL_TEXT = "#121212";
const LOG_CHECK_BORDER = "#D1D1D6";
const LOG_CHECK_GREEN = "#34C759";
const FIELD_ALERT_BG = "rgba(255, 149, 0, 0.28)";
const ACTIVE_ROW_BG = "rgba(79, 142, 247, 0.06)";

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

export function HevySetGridHeader({ isBodyweight }: { isBodyweight: boolean }) {
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
        <Text style={styles.headerLabel}>REPS</Text>
      </View>
      <View style={styles.colCheck}>
        <Text style={styles.headerLabel}> </Text>
      </View>
    </View>
  );
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
  return (
    <View style={styles.stepField}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <Pressable
          onPress={() => onStep(-1)}
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
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          selectTextOnFocus
          returnKeyType="done"
          style={styles.stepInput}
          testID={testID}
        />
        <Pressable
          onPress={() => onStep(1)}
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
        label="WDH."
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
  const weightDisplay = setData.weight?.trim() ? setData.weight : "—";
  const repsDisplay = setData.reps?.trim() ? setData.reps : "—";

  const validation = validateSetFields(setData, isBodyweight);
  const canLogSet = !validation.repsInvalid && !validation.weightInvalid;

  const handleCheck = () => {
    // Tapping a completed set un-checks it and reactivates it for editing —
    // an accidental check used to freeze the row with no way back.
    if (setData.completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdate({ completed: false, rating: null });
      onActivate?.();
      return;
    }

    if (!canLogSet) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (validation.weightInvalid) weightAlertRef.current?.();
      if (validation.repsInvalid) repsAlertRef.current?.();
      return;
    }

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
            <Text style={[styles.setNum, rowMuted && styles.textMuted]}>
              {setIndex + 1}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.colPrev}>
        {isPR ? (
          <View style={styles.prBadge}>
            <Feather name="award" size={11} color="#FFFFFF" />
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
                style={[
                  styles.cellValue,
                  rowMuted && styles.textMuted,
                  validation.weightInvalid && isActive && styles.cellValueAlert,
                ]}
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
              style={[
                styles.cellValue,
                rowMuted && styles.textMuted,
                validation.repsInvalid && isActive && styles.cellValueAlert,
              ]}
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
              : isActive && canLogSet
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
                ? "#FFFFFF"
                : isActive && canLogSet
                  ? LOG_CHECK_GREEN + "99"
                  : LOG_CHECK_BORDER
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

  const stepWeight = useCallback(
    (dir: 1 | -1) => {
      const base = parseFloat(String(draft.weight).replace(",", ".")) || 0;
      const next = Math.max(0, base + dir * WEIGHT_STEP_KG);
      const formatted = clampAndFormatWeightExact(String(next));
      typingRef.current = false;
      setDraft((d) => ({ ...d, weight: formatted }));
      onUpdate({ weight: formatted });
      Haptics.selectionAsync();
    },
    [draft.weight, onUpdate],
  );

  const stepReps = useCallback(
    (dir: 1 | -1) => {
      const base = parseInt(String(draft.reps).replace(/\D/g, ""), 10) || 0;
      const next = Math.max(0, base + dir);
      const formatted = clampAndFormatReps(String(next));
      typingRef.current = false;
      setDraft((d) => ({ ...d, reps: formatted }));
      onUpdate({ reps: formatted });
      Haptics.selectionAsync();
    },
    [draft.reps, onUpdate],
  );

  const displaySet: SetData = {
    ...setData,
    weight: showEditor ? draft.weight : setData.weight,
    reps: showEditor ? draft.reps : setData.reps,
  };

  return (
    <View style={styles.setBlock}>
      <HevySetRow {...props} setData={displaySet} suppressBottomBorder={showEditor} />
      {showEditor ? (
        <HevySetEditor
          setIndex={props.setIndex}
          isBodyweight={isBodyweight}
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

const styles = StyleSheet.create({
  setBlock: {
    backgroundColor: HEVY.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: HEVY.pad,
    backgroundColor: HEVY.surface,
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
    backgroundColor: HEVY.canvas,
    paddingVertical: 5,
    minHeight: 28,
    borderBottomWidth: 0.5,
    borderBottomColor: ROW_SEPARATOR,
  },
  rowMuted: {
    opacity: 0.55,
  },
  rowCompleted: {
    opacity: 0.88,
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
    fontSize: 11,
    fontWeight: "600",
    color: HEVY.textMuted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  setNum: {
    fontSize: 14,
    fontWeight: "600",
    color: CELL_TEXT,
    textAlign: "center",
  },
  prevText: {
    fontSize: 13,
    fontWeight: "400",
    color: HEVY.textSecondary,
  },
  warmupBadge: {
    fontSize: 14,
    fontWeight: "800",
    color: "#D97706",
    textAlign: "center",
  },
  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    backgroundColor: "#D97706",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  cellPress: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cellValue: {
    fontSize: 14,
    fontWeight: "600",
    color: CELL_TEXT,
    textAlign: "center",
    width: "100%",
  },
  cellValueAlert: {
    color: "#C93400",
  },
  alertCellWrap: {
    width: "100%",
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  textMuted: {
    color: HEVY.textMuted,
  },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HEVY.surface,
  },
  checkBoxIdle: {
    borderColor: LOG_CHECK_BORDER,
  },
  checkBoxReady: {
    borderColor: LOG_CHECK_BORDER,
    backgroundColor: LOG_CHECK_GREEN + "0A",
  },
  checkBoxDone: {
    borderColor: LOG_CHECK_GREEN,
    backgroundColor: LOG_CHECK_GREEN,
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
    backgroundColor: HEVY.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: ROW_SEPARATOR,
  },
  stepField: {
    flex: 1,
    gap: 4,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: HEVY.textMuted,
    textAlign: "center",
  },
  stepControls: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ROW_SEPARATOR,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: HEVY.surface,
  },
  stepBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HEVY.canvas,
  },
  stepInput: {
    flex: 1,
    height: 40,
    fontSize: 17,
    fontWeight: "700",
    color: CELL_TEXT,
    textAlign: "center",
    paddingVertical: 0,
  },
});
