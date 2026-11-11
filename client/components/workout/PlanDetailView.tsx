import React, { useMemo, useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ExerciseDbThumb } from "@/components/workout/ExerciseDbThumb";
import { translateMuscleGroup } from "@/lib/exerciseTaxonomy";
import { useLocalizeExerciseName } from "@/hooks/useLocalizeExerciseName";
import { HEVY } from "@/constants/hevyLayout";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import type { Exercise, PlanSchedule, WorkoutDay } from "@/lib/storage";
import { translateDayName } from "@/lib/dayNameLabel";
import { sessionHueIndex, sessionLetter, sessionSlots, supersetLabels } from "@/lib/planStructure";
import { mobilityHue, sessionHues } from "@/constants/palettes";
import { isMobilityDay } from "@/lib/mobilitySplit";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";


type PlanDetailViewProps = {
  days: WorkoutDay[];
  /** The plan's weekday schedule, if it has one — shown per session. */
  schedule?: PlanSchedule;
  /** Drop the side padding when the parent already provides it. */
  flush?: boolean;
  onExercisePress?: (exercise: Exercise) => void;
  onStartDay?: (dayIndex: number) => void;
};

function PlanExerciseRow({
  exercise,
  index,
  isLast,
  supersetLabel,
  onExercisePress,
}: {
  exercise: Exercise;
  index: number;
  isLast: boolean;
  supersetLabel: string | null;
  onExercisePress?: (exercise: Exercise) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const localizeName = useLocalizeExerciseName();
  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 24).duration(220)}
      style={[styles.exerciseRow, isLast && styles.exerciseRowLast]}
    >
      <ExerciseDbThumb
        exerciseName={exercise.name}
        style={styles.thumbWrap}
        onPress={() => onExercisePress?.(exercise)}
        testID={`button-exercise-thumb-${exercise.id}`}
      />
      <View style={styles.exerciseBody}>
        <Text style={styles.exerciseTitle} numberOfLines={2}>
          {localizeName(exercise.name)}
        </Text>
        <View style={styles.tagRow}>
          {supersetLabel ? (
            <View style={[styles.muscleTag, styles.supersetTag, { borderColor: theme.controlOutline }]}>
              <Text style={[styles.muscleTagText, { color: theme.text }]}>{supersetLabel}</Text>
            </View>
          ) : null}
          <View
            style={[
              styles.muscleTag,
              { backgroundColor: theme.ironElevated2 },
            ]}
          >
            <Text
              style={[styles.muscleTagText, { color: theme.chalkDim }]}
              numberOfLines={1}
            >
              {translateMuscleGroup(t, exercise.muscleGroup)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.exerciseSetsCol}>
        <Text style={styles.setsLine}>
          {exercise.sets} × {exercise.reps}
        </Text>
        {exercise.perSide ? (
          <Text style={styles.rirLine}>{t("planDetail.perSide")}</Text>
        ) : null}
        {exercise.targetRIR !== undefined ? (
          <Text style={styles.rirLine}>{exercise.targetRIR} RIR</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function SessionRow({
  day,
  dayIndex,
  schedule,
  initiallyOpen,
  isLast,
  onExercisePress,
  onStartDay,
}: {
  day: WorkoutDay;
  isLast: boolean;
  dayIndex: number;
  schedule?: PlanSchedule;
  initiallyOpen: boolean;
  onExercisePress?: (exercise: Exercise) => void;
  onStartDay?: (dayIndex: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const { dayLabel } = useCommitmentLabels();
  const [open, setOpen] = useState(initiallyOpen);
  const name = translateDayName(t, day.dayName);
  const mobility = isMobilityDay(day);
  const marker = sessionLetter(day.dayName) ?? String(dayIndex + 1);
  const hue = mobility
    ? mobilityHue
    : sessionHues[sessionHueIndex(day.dayName, dayIndex, sessionHues.length)];
  const labels = supersetLabels(day.exercises);
  const slots = sessionSlots(schedule, day.id)
    .map((s) => (s.week ? `${t("planDetail.weekShort", { n: s.week })} ${dayLabel(s.weekday)}` : dayLabel(s.weekday)))
    .join(" · ");

  return (
    <Animated.View
      entering={FadeInDown.delay(dayIndex * 50).duration(260)}
      style={[styles.session, isLast && styles.sessionLast]}
    >
      <View style={styles.sessionHeader}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setOpen((o) => !o);
          }}
          style={styles.sessionToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={name}
          testID={`button-toggle-day-${dayIndex}`}
        >
          {/* Filled in the session's own colour — the same one its dots
              wear in the week strip. */}
          <View style={[styles.marker, { backgroundColor: hue }]}>
            {mobility ? (
              <Feather name="wind" size={17} color={theme.onSessionHue} />
            ) : (
              <Text style={[styles.markerText, { color: theme.onSessionHue }]}>{marker}</Text>
            )}
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.dayName} numberOfLines={2}>
              {name}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.exerciseCountMeta} numberOfLines={1}>
                {[t("planDetail.exerciseCount", { count: day.exercises.length }), slots]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              <Feather
                name={open ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.chalkDim}
              />
            </View>
          </View>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.sessionBody}>
          {onStartDay ? (
            <Pressable
              onPress={() => onStartDay(dayIndex)}
              style={({ pressed }) => [
                styles.startBtn,
                { borderColor: theme.controlOutline, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${t("plans.start")}: ${name}`}
              testID={`button-start-day-${dayIndex}`}
            >
              <Feather name="play" size={12} color={theme.chalk} />
              <Text style={styles.startBtnText}>{t("plans.start")}</Text>
            </Pressable>
          ) : null}
          {day.warmup ? (
            <Text style={styles.warmupLine}>
              {t("planDetail.warmup", { text: day.warmup })}
            </Text>
          ) : null}
          {day.exercises.map((exercise, index) => (
            <PlanExerciseRow
              key={exercise.id}
              exercise={exercise}
              index={index}
              isLast={index === day.exercises.length - 1}
              supersetLabel={labels[index]}
              onExercisePress={onExercisePress}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * A plan's sessions as a list you can scan: one row each — its letter, name,
 * size and weekdays — opening to the exercises on tap. Drawn as stacked open
 * cards, an 8-session plan was 70 exercises of scrolling, and "GK A kurz"
 * and "GK A lang" only differed somewhere in the middle.
 */
export function PlanDetailView({
  days,
  schedule,
  flush = false,
  onExercisePress,
  onStartDay,
}: PlanDetailViewProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  // A short plan reads fine opened up; a longer one starts as its overview.
  const openAll = days.length <= 2;
  return (
    <View style={[styles.root, flush && styles.rootFlush]}>
      {days.map((day, dayIndex) => (
        <SessionRow
          key={day.id ?? `${day.dayName}-${dayIndex}`}
          day={day}
          dayIndex={dayIndex}
          schedule={schedule}
          initiallyOpen={openAll}
          isLast={dayIndex === days.length - 1}
          onExercisePress={onExercisePress}
          onStartDay={onStartDay}
        />
      ))}
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: {
    paddingHorizontal: HEVY.pad,
    paddingTop: 8,
    paddingBottom: 4,
  },
  rootFlush: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  // Rows on the page, not cards: hairlines separate the sessions.
  session: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  sessionLast: {
    borderBottomWidth: 0,
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  sessionToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionBody: {
    paddingBottom: 8,
    paddingLeft: 52,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "Archivo_700Bold",
  },
  // Inside the opened session: one start per screen-full instead of a
  // column of identical pills down every row.
  startBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  startBtnText: {
    color: c.chalk,
    fontSize: 13,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  exerciseCountMeta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
    color: c.chalkDim,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  dayName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
    color: c.chalk,
  },
  exerciseCount: {
    fontSize: 12,
    fontWeight: "500",
    color: c.chalkDim,
    flexShrink: 0,
  },
  cardBody: {
    paddingHorizontal: 14,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: c.iron,
  },
  exerciseBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: c.chalk,
    marginBottom: 2,
    lineHeight: 19,
  },
  exerciseMeta: {
    fontSize: 12,
    color: c.chalkDim,
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
  },
  supersetTag: {
    borderWidth: 1,
  },
  warmupLine: {
    fontSize: 13,
    lineHeight: 18,
    color: c.chalkDim,
    paddingTop: 10,
  },
  muscleTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  muscleTagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  exerciseSetsCol: {
    alignItems: "flex-end",
    minWidth: 52,
  },
  setsLine: {
    fontSize: 13,
    fontWeight: "600",
    color: c.chalk,
    lineHeight: 16,
  },
  rirLine: {
    fontSize: 12,
    color: c.chalkDim,
    marginTop: 2,
  },
});
