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
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";

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

type Props = NativeStackScreenProps<RootStackParamList, "PlanDetail">;

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props["route"]>();
  const { planId } = route.params;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);

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

  const handleStartDay = (dayIndex: number) => {
    if (!plan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ActiveWorkout", {
      planId: plan.id,
      planName: plan.name,
      dayIndex,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      t("plans.deletePlan"),
      t("plans.deleteConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("plans.delete"),
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
              toast.error(t("common.deleteFailed"));
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
        <ThemedText>{t("plans.planNotFound")}</ThemedText>
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
          accessibilityLabel={t("common.back")}
        >
          <Feather name="chevron-left" size={28} color={HEVY.textPrimary} />
        </Pressable>
        <ThemedText style={styles.planName}>{plan.name}</ThemedText>
        <ThemedText style={styles.planInfo}>
          {t("planDetail.daysPerWeekCount", { count: plan.daysPerWeek })} ·{" "}
          {t("planDetail.exerciseCount", {
            count: plan.days.reduce((acc, day) => acc + day.exercises.length, 0),
          })}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <PlanDetailView
          days={plan.days}
          onExercisePress={(exercise) => setDetailExercise(exercise)}
          onStartDay={handleStartDay}
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
                  {t("plans.deletePlan")}
                </ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
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
});
