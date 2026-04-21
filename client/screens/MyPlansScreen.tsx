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
import { LinearGradient } from "expo-linear-gradient";
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
import { WorkoutPlan, getWorkoutPlans, duplicateWorkoutPlan } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PlanCard({
  plan,
  index,
  onStartPress,
  onDuplicate,
  onEdit,
}: {
  plan: WorkoutPlan;
  index: number;
  onStartPress: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const startScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: cardOpacity.value,
  }));

  const startAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: startScale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <AnimatedPressable
        onPress={onEdit}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
          cardOpacity.value = withSpring(0.75, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          cardOpacity.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          animatedStyle,
          styles.planCard,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`card-plan-${plan.id}`}
      >
        {/* Banner: tappable section above Start Workout */}
        <View
          style={[
            styles.planBanner,
            { borderColor: Colors.light.primary + "4D" },
          ]}
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
              {plan.daysPerWeek} days/week • {plan.days.length} workouts
            </ThemedText>
            <ThemedText style={[styles.tapHint, { color: theme.textSecondary }]}>
              Tap to edit
            </ThemedText>
          </View>
          <View style={styles.planMeta}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              style={[styles.duplicateButton, { backgroundColor: theme.backgroundSecondary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`button-duplicate-plan-${plan.id}`}
            >
              <Feather name="copy" size={16} color={theme.textSecondary} />
            </Pressable>
            <Feather name="chevron-right" size={20} color={Colors.light.primary + "99"} />
          </View>
        </View>

        <AnimatedPressable
          onPress={(e) => {
            e.stopPropagation();
            onStartPress();
          }}
          onPressIn={() => {
            startScale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            startScale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
          style={startAnimatedStyle}
          testID={`button-start-plan-${plan.id}`}
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startWorkoutButton}
          >
            <Feather name="play" size={16} color="#FFFFFF" />
            <ThemedText style={styles.startButtonText}>Start Workout</ThemedText>
          </LinearGradient>
        </AnimatedPressable>
      </AnimatedPressable>
    </Animated.View>
  );
}

function EmptyState({
  onCreatePress,
  onImportPress,
}: {
  onCreatePress: () => void;
  onImportPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const importScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const importAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: importScale.value }],
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
      <AnimatedPressable
        onPress={onImportPress}
        onPressIn={() => {
          importScale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
        }}
        onPressOut={() => {
          importScale.value = withSpring(1, { damping: 15, stiffness: 150 });
        }}
        style={[
          importAnimatedStyle,
          styles.importButton,
          { borderColor: Colors.light.primary },
        ]}
        testID="button-import-plan"
      >
        <Feather name="upload" size={18} color={Colors.light.primary} />
        <ThemedText style={styles.importButtonText}>Import from Photo</ThemedText>
      </AnimatedPressable>
    </View>
  );
}

function ImportBannerCard({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
      style={[animatedStyle, styles.importBanner, { borderColor: theme.textSecondary + "60" }]}
    >
      <ThemedText style={styles.importBannerEmoji}>📷</ThemedText>
      <View style={styles.importBannerText}>
        <ThemedText style={styles.importBannerTitle}>Import a plan from a photo</ThemedText>
        <ThemedText style={[styles.importBannerSubtitle, { color: theme.textSecondary }]}>
          Scan any workout plan with AI
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </AnimatedPressable>
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

  const handleImportPlan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ImportWorkout");
  }, [navigation]);

  const handleStartWorkout = (plan: WorkoutPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("StartWorkout", { planId: plan.id });
  };

  const handleEditPlan = (plan: WorkoutPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("EditPlan", { planId: plan.id });
  };

  const handleDuplicate = async (plan: WorkoutPlan) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPlan = await duplicateWorkoutPlan(plan.id);
    if (newPlan) {
      loadPlans();
    }
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
      onStartPress={() => handleStartWorkout(item)}
      onDuplicate={() => handleDuplicate(item)}
      onEdit={() => handleEditPlan(item)}
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
        ListEmptyComponent={<EmptyState onCreatePress={handleCreatePlan} onImportPress={handleImportPlan} />}
        ListFooterComponent={plans.length > 0 ? <ImportBannerCard onPress={handleImportPlan} /> : null}
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
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  planCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  planBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tapHint: {
    fontSize: 11,
    marginTop: 3,
    opacity: 0.8,
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
  startWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
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
  duplicateButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  importButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  importButtonText: {
    color: Colors.light.primary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  importBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    marginHorizontal: 16,
    gap: 12,
  },
  importBannerEmoji: {
    fontSize: 20,
  },
  importBannerText: {
    flex: 1,
  },
  importBannerTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  importBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
