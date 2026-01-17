import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import { WorkoutPlan, getWorkoutPlans } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PlanCard({
  plan,
  index,
  onPress,
}: {
  plan: WorkoutPlan;
  index: number;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          styles.planCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`card-plan-${plan.id}`}
      >
        <View
          style={[
            styles.planIcon,
            { backgroundColor: Colors.light.primary + "15" },
          ]}
        >
          <Feather name="calendar" size={24} color={Colors.light.primary} />
        </View>
        <View style={styles.planInfo}>
          <ThemedText style={styles.planName}>{plan.name}</ThemedText>
          <ThemedText
            style={[styles.planDetails, { color: theme.textSecondary }]}
          >
            {plan.daysPerWeek} days/week
          </ThemedText>
        </View>
        <View style={styles.planMeta}>
          <ThemedText
            style={[styles.planDate, { color: theme.textSecondary }]}
          >
            {formatDate(plan.lastModified)}
          </ThemedText>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-plans.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText style={styles.emptyTitle}>No Workout Plans Yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Create your first workout plan to start tracking your fitness journey
      </ThemedText>
      <AnimatedPressable
        onPress={onCreatePress}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 150 });
        }}
        style={[
          animatedStyle,
          styles.createButton,
          { backgroundColor: Colors.light.primary },
        ]}
        testID="button-create-first-plan"
      >
        <Feather name="plus" size={20} color="#FFFFFF" />
        <ThemedText style={styles.createButtonText}>
          Create Your First Plan
        </ThemedText>
      </AnimatedPressable>
    </View>
  );
}

export default function MyPlansScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const loadedPlans = await getWorkoutPlans();
      setPlans(loadedPlans);
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPlans();
  };

  const handleCreatePlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("CreatePlan");
  };

  const handlePlanPress = (plan: WorkoutPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PlanDetail", { planId: plan.id });
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: WorkoutPlan;
    index: number;
  }) => (
    <PlanCard
      plan={item}
      index={index}
      onPress={() => handlePlanPress(item)}
    />
  );

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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl + 80,
          },
          plans.length === 0 && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={plans}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState onCreatePress={handleCreatePlan} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.light.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  planIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  planDetails: {
    fontSize: 14,
  },
  planMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  planDate: {
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
    marginBottom: Spacing["2xl"],
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
