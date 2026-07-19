import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import { ExerciseDbThumb } from "@/components/workout/ExerciseDbThumb";
import { translateMuscleGroup, getMuscleGroupColor } from "@/lib/exerciseTaxonomy";
import { HEVY } from "@/constants/hevyLayout";
import { Colors } from "@/constants/theme";
import type { Exercise, WorkoutDay } from "@/lib/storage";

const TITLE_COLOR = "#1C1C1E";
const META_COLOR = "#8E8E93";
const HAIRLINE = "#ECECEF";

type PlanDetailViewProps = {
  days: WorkoutDay[];
  onExercisePress?: (exercise: Exercise) => void;
  onStartDay?: (dayIndex: number) => void;
};

function dayLetter(index: number): string {
  // A, B, C … then fall back to numbers beyond Z.
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function PlanExerciseRow({
  exercise,
  index,
  isLast,
  onExercisePress,
}: {
  exercise: Exercise;
  index: number;
  isLast: boolean;
  onExercisePress?: (exercise: Exercise) => void;
}) {
  const { t } = useTranslation();
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
          {exercise.name}
        </Text>
        <View
          style={[
            styles.muscleTag,
            { backgroundColor: getMuscleGroupColor(exercise.muscleGroup) + "1A" },
          ]}
        >
          <Text
            style={[styles.muscleTagText, { color: getMuscleGroupColor(exercise.muscleGroup) }]}
            numberOfLines={1}
          >
            {translateMuscleGroup(t, exercise.muscleGroup)}
          </Text>
        </View>
      </View>
      <View style={styles.exerciseSetsCol}>
        <Text style={styles.setsLine}>
          {exercise.sets} × {exercise.reps}
        </Text>
        {exercise.targetRIR !== undefined ? (
          <Text style={styles.rirLine}>{exercise.targetRIR} RIR</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function DayCard({
  day,
  dayIndex,
  onExercisePress,
  onStartDay,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onExercisePress?: (exercise: Exercise) => void;
  onStartDay?: (dayIndex: number) => void;
}) {
  const { t } = useTranslation();
  const letter = dayLetter(dayIndex);
  const canStart = typeof onStartDay === "function";

  const headerInner = (
    <>
      <View style={styles.dayBadge}>
        <Text style={styles.dayBadgeText}>{letter}</Text>
      </View>
      <View style={styles.headerTextCol}>
        <Text style={styles.dayOverline}>
          {t("planDetail.dayLabel")} {letter}
        </Text>
        <Text style={styles.dayName} numberOfLines={1}>
          {day.dayName}
        </Text>
        <Text style={styles.exerciseCountMeta}>
          {t("planDetail.exerciseCount", { count: day.exercises.length })}
        </Text>
      </View>
      {canStart ? (
        <View style={styles.startBtn}>
          <Feather name="play" size={14} color="#FFFFFF" />
          <Text style={styles.startBtnText}>{t("plans.start")}</Text>
        </View>
      ) : (
        <Text style={styles.exerciseCount}>
          {t("planDetail.exerciseCount", { count: day.exercises.length })}
        </Text>
      )}
    </>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(dayIndex * 70).duration(300)}
      style={styles.card}
    >
      {canStart ? (
        <Pressable
          onPress={() => onStartDay?.(dayIndex)}
          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          style={({ pressed }) => [
            styles.cardHeader,
            pressed && styles.cardHeaderPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${t("planDetail.dayLabel")} ${letter}: ${day.dayName}`}
          testID={`button-start-day-${dayIndex}`}
        >
          {headerInner}
        </Pressable>
      ) : (
        <View style={styles.cardHeader}>{headerInner}</View>
      )}

      <View style={styles.cardBody}>
        {day.exercises.map((exercise, index) => (
          <PlanExerciseRow
            key={exercise.id}
            exercise={exercise}
            index={index}
            isLast={index === day.exercises.length - 1}
            onExercisePress={onExercisePress}
          />
        ))}
      </View>
    </Animated.View>
  );
}

/** Plan routine list — each training day is a clearly separated card. */
export function PlanDetailView({
  days,
  onExercisePress,
  onStartDay,
}: PlanDetailViewProps) {
  return (
    <View style={styles.root}>
      {days.map((day, dayIndex) => (
        <DayCard
          key={`${day.dayName}-${dayIndex}`}
          day={day}
          dayIndex={dayIndex}
          onExercisePress={onExercisePress}
          onStartDay={onStartDay}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: HEVY.pad,
    paddingTop: 8,
    paddingBottom: 4,
  },
  card: {
    backgroundColor: HEVY.surface,
    borderRadius: 18,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    // Soft elevation so each day reads as its own block.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  cardHeaderPressed: {
    backgroundColor: HEVY.canvas,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  exerciseCountMeta: {
    fontSize: 12,
    fontWeight: "500",
    color: META_COLOR,
    marginTop: 2,
  },
  dayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "Montserrat_700Bold",
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  dayOverline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Colors.light.primary,
    marginBottom: 1,
  },
  dayName: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: TITLE_COLOR,
  },
  exerciseCount: {
    fontSize: 12,
    fontWeight: "500",
    color: META_COLOR,
    flexShrink: 0,
  },
  cardBody: {
    paddingHorizontal: 14,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: HEVY.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: HEVY.canvas,
  },
  exerciseBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  exerciseTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TITLE_COLOR,
    marginBottom: 2,
    lineHeight: 19,
  },
  exerciseMeta: {
    fontSize: 12,
    color: META_COLOR,
    lineHeight: 16,
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
    color: TITLE_COLOR,
    lineHeight: 16,
  },
  rirLine: {
    fontSize: 12,
    color: META_COLOR,
    marginTop: 2,
  },
});
