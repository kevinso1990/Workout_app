import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { WorkoutSession, getWorkoutHistory } from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StatCard({
  icon,
  label,
  value,
  color,
  index,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  color: string;
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

function WorkoutHistoryItem({
  session,
  index,
}: {
  session: WorkoutSession;
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
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 100).duration(400)}>
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          animatedStyle,
          styles.historyItem,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View
          style={[
            styles.historyIcon,
            { backgroundColor: Colors.light.success + "20" },
          ]}
        >
          <Feather name="check-circle" size={20} color={Colors.light.success} />
        </View>
        <View style={styles.historyInfo}>
          <ThemedText style={styles.historyTitle}>{session.dayName}</ThemedText>
          <ThemedText
            style={[styles.historySubtitle, { color: theme.textSecondary }]}
          >
            {session.planName}
          </ThemedText>
        </View>
        <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
          {formatDate(session.completedAt)}
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState() {
  const { theme } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-progress.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText style={styles.emptyTitle}>No Workouts Yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Complete your first workout to start tracking your progress
      </ThemedText>
    </View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const loadedHistory = await getWorkoutHistory();
      setHistory(loadedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadHistory();
  };

  const calculateStreak = () => {
    if (history.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedHistory = [...history].sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);

      const hasWorkout = sortedHistory.some((session) => {
        const sessionDate = new Date(session.completedAt);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === checkDate.getTime();
      });

      if (hasWorkout) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  };

  const getThisWeekCount = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return history.filter(
      (session) => new Date(session.completedAt) >= startOfWeek
    ).length;
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
        history.length === 0 && styles.emptyContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.light.primary}
        />
      }
    >
      {history.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              icon="activity"
              label="Total Workouts"
              value={history.length.toString()}
              color={Colors.light.primary}
              index={0}
            />
            <StatCard
              icon="zap"
              label="Day Streak"
              value={calculateStreak().toString()}
              color="#FFB800"
              index={1}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon="calendar"
              label="This Week"
              value={getThisWeekCount().toString()}
              color={Colors.light.success}
              index={2}
            />
            <StatCard
              icon="trending-up"
              label="Best Streak"
              value={Math.max(calculateStreak(), 1).toString()}
              color="#9B59B6"
              index={3}
            />
          </View>

          <Animated.View
            entering={FadeInDown.delay(300).duration(400)}
            style={styles.sectionHeader}
          >
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
          </Animated.View>

          <View style={styles.historyList}>
            {history.slice(0, 10).map((session, index) => (
              <WorkoutHistoryItem
                key={session.id}
                session={session}
                index={index}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: 13,
    textAlign: "center",
  },
  sectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  historyList: {
    gap: Spacing.md,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  historySubtitle: {
    fontSize: 14,
  },
  historyDate: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
