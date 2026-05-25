import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { prewarmExerciseMedia } from "@/services/exerciseMedia";
import ExerciseDetailModal from "@/components/ExerciseDetailModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { PlanDetailView } from "@/components/workout/PlanDetailView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { HEVY, hevyHeaderInsets, hevyHairline } from "@/constants/hevyLayout";
import {
  WorkoutPlan,
  getWorkoutPlans,
  deleteWorkoutPlan,
  type Exercise,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = NativeStackScreenProps<RootStackParamList, "PlanDetail">;

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
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

  useEffect(() => {
    if (!plan) return;
    const exerciseNames = plan.days.flatMap((day) =>
      day.exercises.map((ex) => ex.name)
    );
    prewarmExerciseMedia(exerciseNames);
  }, [plan]);

  const handleOpenWorkout = () => {
    if (!plan) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.navigate("StartWorkout", { planId: plan.id });
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
    <View style={styles.container}>
      <ExerciseDetailModal
        visible={detailExercise !== null}
        exerciseName={detailExercise?.name ?? ""}
        muscleGroup={detailExercise?.muscleGroup ?? "Exercise"}
        onClose={() => setDetailExercise(null)}
      />

      <View style={[styles.screenHeader, hevyHeaderInsets(insets.top), hevyHairline]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={28} color={HEVY.textPrimary} />
        </Pressable>
        <ThemedText style={styles.planName}>{plan.name}</ThemedText>
        <ThemedText style={styles.planInfo}>
          {plan.daysPerWeek} days per week ·{" "}
          {plan.days.reduce((acc, day) => acc + day.exercises.length, 0)} exercises
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <PlanDetailView
          days={plan.days}
          onExercisePress={(exercise) => setDetailExercise(exercise)}
        />

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
          { paddingBottom: insets.bottom + HEVY.pad },
        ]}
      >
        <AnimatedPressable
          onPress={handleOpenWorkout}
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
          <View style={[styles.startFab, { backgroundColor: Colors.light.primary }]}>
            <Feather name="play" size={28} color="#FFFFFF" />
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEVY.canvas,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HEVY.canvas,
  },
  screenHeader: {
    backgroundColor: HEVY.surface,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
    marginLeft: -4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
  },
  planName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: HEVY.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 6,
  },
  planInfo: {
    fontSize: 15,
    color: HEVY.textSecondary,
    lineHeight: 21,
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
    borderWidth: StyleSheet.hairlineWidth,
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
    paddingHorizontal: HEVY.pad,
    paddingTop: HEVY.pad,
    backgroundColor: HEVY.canvas,
  },
  startFab: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
