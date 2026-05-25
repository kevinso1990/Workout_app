import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ExerciseDbThumb } from "@/components/workout/ExerciseDbThumb";
import { HEVY } from "@/constants/hevyLayout";
import type { Exercise, WorkoutDay } from "@/lib/storage";

const TITLE_COLOR = "#1C1C1E";
const META_COLOR = "#8E8E93";
const HAIRLINE = "#E5E5EA";

type PlanDetailViewProps = {
  days: WorkoutDay[];
  onExercisePress?: (exercise: Exercise) => void;
};

function PlanExerciseRow({
  exercise,
  index,
  onExercisePress,
}: {
  exercise: Exercise;
  index: number;
  onExercisePress?: (exercise: Exercise) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(40 + index * 30).duration(220)}
      style={styles.exerciseRow}
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
        <Text style={styles.exerciseMeta} numberOfLines={1}>
          {exercise.muscleGroup}
        </Text>
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

function DayBlock({
  day,
  dayIndex,
  onExercisePress,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onExercisePress?: (exercise: Exercise) => void;
}) {
  return (
    <View style={styles.dayBlock}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayIndex}>Day {dayIndex + 1}</Text>
        <Text style={styles.dayName} numberOfLines={1}>
          {day.dayName}
        </Text>
      </View>
      {day.exercises.map((exercise, index) => (
        <PlanExerciseRow
          key={exercise.id}
          exercise={exercise}
          index={index}
          onExercisePress={onExercisePress}
        />
      ))}
    </View>
  );
}

/** Hevy-style flat plan routine list — read-only, no delete/replace controls. */
export function PlanDetailView({ days, onExercisePress }: PlanDetailViewProps) {
  return (
    <View style={styles.root}>
      {days.map((day, dayIndex) => (
        <DayBlock
          key={`${day.dayName}-${dayIndex}`}
          day={day}
          dayIndex={dayIndex}
          onExercisePress={onExercisePress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: HEVY.surface,
  },
  dayBlock: {
    marginBottom: 2,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: HEVY.pad,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 6,
  },
  dayIndex: {
    fontSize: 12,
    fontWeight: "500",
    color: META_COLOR,
  },
  dayName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: TITLE_COLOR,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: HEVY.pad,
    backgroundColor: HEVY.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  thumbWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: HEVY.canvas,
  },
  exerciseBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: TITLE_COLOR,
    marginBottom: 1,
    lineHeight: 18,
  },
  exerciseMeta: {
    fontSize: 12,
    color: META_COLOR,
    lineHeight: 16,
  },
  exerciseSetsCol: {
    alignItems: "flex-end",
    minWidth: 52,
  },
  setsLine: {
    fontSize: 12,
    fontWeight: "500",
    color: META_COLOR,
    lineHeight: 16,
  },
  rirLine: {
    fontSize: 12,
    color: META_COLOR,
    marginTop: 1,
  },
});
