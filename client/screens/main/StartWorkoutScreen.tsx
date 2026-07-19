import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { BorderRadius, Colors } from "@/constants/theme";
import { HEVY, hevyHeaderInsets, hevyHairline } from "@/constants/hevyLayout";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getWorkoutPlans, WorkoutPlan, WorkoutDay, getWorkoutHistory, WorkoutSession } from "@/lib/storage";
import {
  formatLastPerformedLabel,
  hasCompletedWorkoutSession,
} from "@/lib/workoutDates";
import { prefetchWorkoutExerciseMedia } from "@/services/exerciseMedia";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type StartWorkoutRouteProp = RouteProp<RootStackParamList, "StartWorkout">;

function DayCard({
  day,
  dayIndex,
  onPress,
  index,
  dayLastPerformedLabel,
}: {
  day: WorkoutDay;
  dayIndex: number;
  onPress: () => void;
  index: number;
  dayLastPerformedLabel: string | null;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 60).duration(350)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[animatedStyle, styles.dayCard]}
        testID={`button-start-day-${dayIndex}`}
      >
        <View style={styles.dayCardRow}>
          <View style={styles.dayIndex}>
            <ThemedText style={styles.dayIndexText}>{dayIndex + 1}</ThemedText>
          </View>
          <View style={styles.dayInfo}>
            <ThemedText style={styles.dayName}>{day.dayName}</ThemedText>
            {dayLastPerformedLabel ? (
              <ThemedText style={styles.dayMeta} numberOfLines={1}>
                {dayLastPerformedLabel}
              </ThemedText>
            ) : null}
            <ThemedText style={styles.dayExerciseCount}>
              {t("planDetail.exerciseCount", { count: day.exercises.length })}
            </ThemedText>
          </View>
          <View style={styles.playBtn}>
            <Feather name="play" size={18} color="#FFFFFF" />
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function StartWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<StartWorkoutRouteProp>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [route.params?.planId]),
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plans, workoutHistory] = await Promise.all([
        getWorkoutPlans(),
        getWorkoutHistory(),
      ]);

      const targetPlan = route.params?.planId
        ? plans.find((p) => p.id === route.params.planId)
        : plans[0];

      const resolved = targetPlan || null;
      setPlan(resolved);
      setHistory(workoutHistory);
      if (resolved) {
        const names = [
          ...new Set(
            resolved.days.flatMap((d) => d.exercises.map((e) => e.name)),
          ),
        ];
        prefetchWorkoutExerciseMedia(names);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLastSessionForDay = (dayName: string): WorkoutSession | null => {
    if (!plan) return null;
    const sessions = history
      .filter((s) => s.planId === plan.id && s.dayName === dayName)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
    return sessions[0] || null;
  };

  const lastPlanSession = useMemo(() => {
    if (!plan) return null;
    const sessions = history
      .filter((s) => s.planId === plan.id)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
    return sessions[0] || null;
  }, [plan, history]);

  const planLastPerformedLabel = useMemo(() => {
    if (!hasCompletedWorkoutSession(lastPlanSession) || !lastPlanSession) {
      return null;
    }
    return `${t("startWorkout.lastPerformedLabel")}: ${formatLastPerformedLabel(lastPlanSession, t)}`;
  }, [lastPlanSession, t]);

  const dayLastPerformedLabelFor = useCallback(
    (session: WorkoutSession | null): string | null => {
      if (!hasCompletedWorkoutSession(session) || !session) return null;
      return `${t("startWorkout.lastPerformedLabel")}: ${formatLastPerformedLabel(session, t)}`;
    },
    [t],
  );

  const handleStartDay = (dayIndex: number) => {
    if (!plan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ActiveWorkout", {
      planId: plan.id,
      planName: plan.name,
      dayIndex,
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    );
  }

  if (!plan) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <Feather name="calendar" size={48} color={HEVY.textMuted} />
        <ThemedText style={styles.emptyText}>{t("plans.planNotFound")}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View pointerEvents="box-none" style={[styles.screenHeader, hevyHeaderInsets(insets.top), hevyHairline]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Feather name="chevron-left" size={28} color={HEVY.textPrimary} />
        </Pressable>
        <ThemedText style={styles.planTitle}>{plan.name}</ThemedText>
        {planLastPerformedLabel ? (
          <ThemedText style={styles.planMeta}>{planLastPerformedLabel}</ThemedText>
        ) : null}
        <ThemedText style={styles.sectionHint}>
          {t("startWorkout.chooseDay", { defaultValue: "Choose a workout to start" })}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + HEVY.padLg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.daysList}>
          {plan.days.map((day, index) => (
            <DayCard
              key={index}
              day={day}
              dayIndex={index}
              dayLastPerformedLabel={dayLastPerformedLabelFor(
                getLastSessionForDay(day.dayName),
              )}
              onPress={() => handleStartDay(index)}
              index={index}
            />
          ))}
        </View>
      </ScrollView>
    </ThemedView>
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: HEVY.pad,
    backgroundColor: HEVY.canvas,
  },
  emptyText: {
    fontSize: 16,
    color: HEVY.textSecondary,
  },
  screenHeader: {
    backgroundColor: HEVY.surface,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 8,
    marginLeft: -4,
  },
  planTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: HEVY.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  planMeta: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: HEVY.textSecondary,
    lineHeight: 20,
  },
  sectionHint: {
    marginTop: HEVY.pad,
    fontSize: 15,
    color: HEVY.textMuted,
    lineHeight: 21,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HEVY.pad,
    paddingTop: HEVY.pad,
  },
  daysList: {
    gap: HEVY.pad,
  },
  dayCard: {
    backgroundColor: HEVY.surface,
    borderRadius: BorderRadius.md,
    padding: HEVY.pad,
  },
  dayCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayIndex: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(91, 107, 122, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: HEVY.pad,
  },
  dayIndexText: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: Colors.light.primary,
  },
  dayInfo: {
    flex: 1,
    minWidth: 0,
  },
  dayName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: HEVY.textPrimary,
    marginBottom: 2,
  },
  dayMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: HEVY.textSecondary,
    marginBottom: 2,
  },
  dayExerciseCount: {
    fontSize: 13,
    color: HEVY.textMuted,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: HEVY.pad,
  },
});
