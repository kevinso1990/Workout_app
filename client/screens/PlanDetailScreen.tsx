import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  WorkoutPlan,
  WorkoutDay,
  Exercise,
  getWorkoutPlans,
  deleteWorkoutPlan,
  addWorkoutSession,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = NativeStackScreenProps<RootStackParamList, "PlanDetail">;

function ExerciseItem({
  exercise,
  index,
}: {
  exercise: Exercise;
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 50).duration(300)}
      style={[styles.exerciseItem, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.exerciseInfo}>
        <ThemedText style={styles.exerciseName}>{exercise.name}</ThemedText>
        <ThemedText
          style={[styles.exerciseMuscle, { color: theme.textSecondary }]}
        >
          {exercise.muscleGroup}
        </ThemedText>
      </View>
      <View style={styles.exerciseSets}>
        <ThemedText style={styles.setsText}>
          {exercise.sets} x {exercise.reps}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function DaySection({
  day,
  dayIndex,
  onStartWorkout,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onStartWorkout: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + dayIndex * 100).duration(400)}
      style={styles.daySection}
    >
      <View style={styles.dayHeader}>
        <View
          style={[
            styles.dayBadge,
            { backgroundColor: Colors.light.primary + "15" },
          ]}
        >
          <ThemedText
            style={[styles.dayBadgeText, { color: Colors.light.primary }]}
          >
            Day {dayIndex + 1}
          </ThemedText>
        </View>
        <ThemedText style={styles.dayName}>{day.dayName}</ThemedText>
        <AnimatedPressable
          onPress={onStartWorkout}
          onPressIn={() => {
            scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
          style={[
            animatedStyle,
            styles.startDayButton,
            { backgroundColor: Colors.light.primary },
          ]}
          testID={`button-start-day-${dayIndex + 1}`}
        >
          <Feather name="play" size={16} color="#FFFFFF" />
        </AnimatedPressable>
      </View>

      <View style={styles.exercisesList}>
        {day.exercises.map((exercise, index) => (
          <ExerciseItem
            key={exercise.id}
            exercise={exercise}
            index={index}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const loadPlan = useCallback(async () => {
    try {
      const plans = await getWorkoutPlans();
      const foundPlan = plans.find((p) => p.id === planId);
      setPlan(foundPlan || null);
    } catch (error) {
      console.error("Error loading plan:", error);
    } finally {
      setIsLoading(false);
    }
  }, [planId]);

  useFocusEffect(
    useCallback(() => {
      loadPlan();
    }, [loadPlan])
  );

  const handleStartWorkout = async (dayIndex: number) => {
    if (!plan) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const day = plan.days[dayIndex];
    const session = {
      id: Date.now().toString(),
      planId: plan.id,
      planName: plan.name,
      dayName: day.dayName,
      completedAt: new Date().toISOString(),
      exercises: day.exercises,
    };

    try {
      await addWorkoutSession(session);
      Alert.alert(
        "Workout Complete!",
        `Great job completing your ${day.dayName} workout!`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error saving workout:", error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Plan",
      "Are you sure you want to delete this workout plan? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteWorkoutPlan(planId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting plan:", error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator color={Colors.light.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ThemedText>Plan not found</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.header}
        >
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <ThemedText
            style={[styles.planInfo, { color: theme.textSecondary }]}
          >
            {plan.daysPerWeek} days per week · {plan.days.reduce((acc, day) => acc + day.exercises.length, 0)} exercises
          </ThemedText>
        </Animated.View>

        {plan.days.map((day, index) => (
          <DaySection
            key={index}
            day={day}
            dayIndex={index}
            onStartWorkout={() => handleStartWorkout(index)}
          />
        ))}

        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={styles.deleteSection}
        >
          <Pressable
            onPress={handleDelete}
            disabled={isDeleting}
            style={[
              styles.deleteButton,
              { borderColor: Colors.light.error },
            ]}
            testID="button-delete-plan"
          >
            {isDeleting ? (
              <ActivityIndicator color={Colors.light.error} />
            ) : (
              <>
                <Feather name="trash-2" size={18} color={Colors.light.error} />
                <ThemedText
                  style={[styles.deleteButtonText, { color: Colors.light.error }]}
                >
                  Delete Plan
                </ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <AnimatedPressable
          onPress={() => handleStartWorkout(0)}
          onPressIn={() => {
            buttonScale.value = withSpring(0.96, {
              damping: 15,
              stiffness: 150,
            });
          }}
          onPressOut={() => {
            buttonScale.value = withSpring(1, {
              damping: 15,
              stiffness: 150,
            });
          }}
          style={animatedButtonStyle}
          testID="button-start-workout"
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            <Feather name="play" size={20} color="#FFFFFF" />
            <ThemedText style={styles.startButtonText}>
              Start Workout
            </ThemedText>
          </LinearGradient>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  planName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  planInfo: {
    fontSize: 15,
  },
  daySection: {
    marginBottom: Spacing["2xl"],
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  dayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    marginRight: Spacing.sm,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dayName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  startDayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  exercisesList: {
    gap: Spacing.sm,
  },
  exerciseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  exerciseMuscle: {
    fontSize: 13,
  },
  exerciseSets: {
    alignItems: "flex-end",
  },
  setsText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  deleteSection: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
