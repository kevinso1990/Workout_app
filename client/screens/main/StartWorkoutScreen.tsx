import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { LinearGradient } from "expo-linear-gradient";
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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getWorkoutPlans, WorkoutPlan, WorkoutDay, getWorkoutHistory, WorkoutSession } from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type StartWorkoutRouteProp = RouteProp<RootStackParamList, "StartWorkout">;

function DayCard({
  day,
  dayIndex,
  planId,
  planName,
  lastSession,
  onPress,
  index,
}: {
  day: WorkoutDay;
  dayIndex: number;
  planId: string;
  planName: string;
  lastSession: WorkoutSession | null;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          animatedStyle,
          styles.dayCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`button-start-day-${dayIndex}`}
      >
        <View style={styles.dayCardContent}>
          <View
            style={[
              styles.dayNumber,
              { backgroundColor: Colors.light.primary + "15" },
            ]}
          >
            <ThemedText
              style={[styles.dayNumberText, { color: Colors.light.primary }]}
            >
              {dayIndex + 1}
            </ThemedText>
          </View>
          <View style={styles.dayInfo}>
            <ThemedText style={[styles.dayLabel, { color: theme.textSecondary }]}>
              Day {dayIndex + 1}
            </ThemedText>
            <ThemedText style={styles.dayName}>{day.dayName}</ThemedText>
            <ThemedText
              style={[styles.exerciseCount, { color: theme.textSecondary }]}
            >
              {day.exercises.length} exercises
            </ThemedText>
            {lastSession ? (
              <View style={styles.lastSessionRow}>
                <Feather
                  name="clock"
                  size={12}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={[styles.lastSession, { color: theme.textSecondary }]}
                >
                  Last: {formatDate(lastSession.completedAt)}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            <Feather name="play" size={18} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function StartWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<StartWorkoutRouteProp>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [route.params?.planId])
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
      
      setPlan(targetPlan || null);
      setHistory(workoutHistory);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getLastSessionForDay = (dayName: string): WorkoutSession | null => {
    if (!plan) return null;
    const sessions = history.filter(
      (s) => s.planId === plan.id && s.dayName === dayName
    );
    return sessions[0] || null;
  };

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
        <Feather name="calendar" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
          No workout plan found
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose a workout to start
          </ThemedText>
        </Animated.View>

        <View style={styles.daysContainer}>
          {plan.days.map((day, index) => (
            <DayCard
              key={index}
              day={day}
              dayIndex={index}
              planId={plan.id}
              planName={plan.name}
              lastSession={getLastSessionForDay(day.dayName)}
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing["2xl"],
  },
  planName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: Spacing["2xl"],
  },
  daysContainer: {
    gap: Spacing.md,
  },
  dayCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  dayCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayNumber: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  dayNumberText: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  dayInfo: {
    flex: 1,
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dayName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  exerciseCount: {
    fontSize: 13,
  },
  lastSessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  lastSession: {
    fontSize: 12,
  },
  startButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
