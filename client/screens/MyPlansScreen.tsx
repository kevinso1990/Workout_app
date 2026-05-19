import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
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
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { HEVY } from "@/constants/hevyLayout";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  WorkoutPlan,
  getWorkoutPlans,
  getWorkoutHistory,
  duplicateWorkoutPlan,
  deleteWorkoutPlan,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import { getApiUrl } from "@/lib/query-client";
import { buildDailyBriefingPayload } from "@/lib/coachHelpers";
import { isCoachTipRenderable } from "@/lib/coachTip";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function firstDayExercisePreview(plan: WorkoutPlan): string {
  const names = plan.days[0]?.exercises.map((e) => e.name).filter(Boolean) ?? [];
  return names.join(", ");
}

function PlanCard({
  plan,
  index,
  onViewPlan,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  plan: WorkoutPlan;
  index: number;
  onViewPlan: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const scale = useSharedValue(1);
  const exerciseLine = useMemo(() => firstDayExercisePreview(plan), [plan]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const openContextMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const options = [
      "Plan bearbeiten",
      "Duplizieren",
      "Plan löschen",
      "Abbrechen",
    ];
    const cancelButtonIndex = 3;
    const destructiveButtonIndex = 2;

    const onSelect = (buttonIndex: number) => {
      if (buttonIndex === 0) onEdit();
      else if (buttonIndex === 1) onDuplicate();
      else if (buttonIndex === 2) onDelete();
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
          title: plan.name,
        },
        onSelect,
      );
    } else {
      Alert.alert(plan.name, undefined, [
        { text: "Plan bearbeiten", onPress: onEdit },
        { text: "Duplizieren", onPress: onDuplicate },
        { text: "Plan löschen", style: "destructive", onPress: onDelete },
        { text: "Abbrechen", style: "cancel" },
      ]);
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(350)}>
      <View style={styles.planCard} testID={`card-plan-${plan.id}`}>
        <Pressable
          onPress={openContextMenu}
          hitSlop={12}
          style={styles.menuBtn}
          testID={`button-plan-menu-${plan.id}`}
          accessibilityRole="button"
          accessibilityLabel="Plan options"
        >
          <Feather name="more-horizontal" size={22} color={HEVY.textMuted} />
        </Pressable>

        <AnimatedPressable
          onPress={onViewPlan}
          onPressIn={() => {
            scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
          style={animatedStyle}
        >
          <ThemedText style={styles.planName} numberOfLines={2}>
            {plan.name}
          </ThemedText>
          <ThemedText style={styles.planMeta}>
            {plan.daysPerWeek} workouts/week · {plan.days.length} days
          </ThemedText>
          {exerciseLine ? (
            <ThemedText
              style={styles.exercisePreview}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {exerciseLine}
            </ThemedText>
          ) : null}
        </AnimatedPressable>
      </View>
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
  const { t } = useTranslation();
  const importScale = useSharedValue(1);
  const createScale = useSharedValue(1);

  const importAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: importScale.value }],
  }));

  const createAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createScale.value }],
  }));

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconBadge,
          {
            backgroundColor: Colors.light.primary + "12",
            borderColor: Colors.light.primary + "30",
          },
        ]}
      >
        <Feather name="layers" size={28} color={Colors.light.primary} />
      </View>

      <ThemedText style={styles.emptyTitle}>
        {t("plans.emptyState.title")}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {t("plans.emptyState.subtitle")}
      </ThemedText>

      <AnimatedPressable
        onPress={onImportPress}
        onPressIn={() => {
          importScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          importScale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          importAnimatedStyle,
          styles.emptyPrimaryBtn,
          { backgroundColor: Colors.light.primary },
        ]}
        testID="button-import-plan-empty"
      >
        <Feather name="camera" size={20} color="#FFFFFF" />
        <ThemedText style={styles.emptyPrimaryBtnText}>
          {t("plans.emptyState.importPrimary")}
        </ThemedText>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={onCreatePress}
        onPressIn={() => {
          createScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          createScale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          createAnimatedStyle,
          styles.emptySecondaryBtn,
          { borderColor: HEVY.separator },
        ]}
        testID="button-create-first-plan"
      >
        <Feather name="edit-3" size={18} color={HEVY.textPrimary} />
        <ThemedText style={styles.emptySecondaryBtnText}>
          {t("plans.emptyState.createSecondary")}
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
  const { t, i18n } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [bannerHeight, setBannerHeight] = useState(70);
  const [coachBrief, setCoachBrief] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("importBannerDismissed").then((v) => {
      if (v === "true") setBannerDismissed(true);
    });
  }, []);

  const dismissBanner = useCallback(async () => {
    await AsyncStorage.setItem("importBannerDismissed", "true");
    setBannerDismissed(true);
  }, []);

  const fetchCoachBrief = useCallback(
    async (loadedPlans: WorkoutPlan[]) => {
      if (loadedPlans.length === 0) {
        setCoachBrief(null);
        return;
      }
      try {
        const history = await getWorkoutHistory();
        const body = buildDailyBriefingPayload(loadedPlans, history, i18n.language);
        const url = new URL("/api/coach/daily-briefing", getApiUrl()).toString();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setCoachBrief(null);
          return;
        }
        const data = (await res.json()) as { brief?: string };
        const raw = typeof data.brief === "string" ? data.brief.trim() : "";
        setCoachBrief(isCoachTipRenderable(raw) ? raw : null);
      } catch {
        setCoachBrief(null);
      }
    },
    [i18n.language],
  );

  const loadPlans = useCallback(async () => {
    try {
      const loadedPlans = await getWorkoutPlans();
      setPlans(loadedPlans);
      void fetchCoachBrief(loadedPlans);
    } catch (error) {
      console.error("Error loading plans:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchCoachBrief]);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
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

  const handleViewPlan = (plan: WorkoutPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PlanDetail", { planId: plan.id });
  };

  const handleEditPlan = (plan: WorkoutPlan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("EditPlan", { planId: plan.id });
  };

  const handleDuplicate = async (plan: WorkoutPlan) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newPlan = await duplicateWorkoutPlan(plan.id);
    if (newPlan) loadPlans();
  };

  const handleDeletePlan = (plan: WorkoutPlan) => {
    Alert.alert(
      "Delete plan",
      `Remove “${plan.name}”? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWorkoutPlan(plan.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              loadPlans();
            } catch (error) {
              console.error("Error deleting plan:", error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            }
          },
        },
      ],
    );
  };

  const listPaddingTop = paddingTopUnderHeader(headerHeight, insets.top, Spacing.md);

  const renderPlan = useCallback(
    ({ item, index }: { item: WorkoutPlan; index: number }) => (
      <PlanCard
        plan={item}
        index={index}
        onViewPlan={() => handleViewPlan(item)}
        onDuplicate={() => handleDuplicate(item)}
        onEdit={() => handleEditPlan(item)}
        onDelete={() => handleDeletePlan(item)}
      />
    ),
    [],
  );

  return (
    <View style={[styles.screen, { backgroundColor: HEVY.canvas }]}>
      {!bannerDismissed ? (
        <View
          onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)}
          style={[
            styles.importTopBanner,
            {
              top: listPaddingTop + 8,
              backgroundColor: theme.backgroundDefault,
              borderColor: HEVY.separator,
            },
          ]}
        >
          <ThemedText style={styles.importBannerEmoji}>📄</ThemedText>
          <View style={styles.importBannerContent}>
            <ThemedText style={styles.importBannerTitle}>
              {t("plans.importBanner.title", { defaultValue: "Import a plan" })}
            </ThemedText>
            <ThemedText
              style={[styles.importBannerSubtitle, { color: theme.textSecondary }]}
            >
              {t("plans.importBanner.subtitle", {
                defaultValue: "PDF or photo → AI review",
              })}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleImportPlan}
            style={[styles.importBannerButton, { backgroundColor: Colors.light.primary }]}
          >
            <ThemedText style={styles.importBannerButtonText}>
              {t("plans.importBanner.cta", { defaultValue: "Import" })}
            </ThemedText>
          </Pressable>
          <Pressable onPress={dismissBanner} style={styles.importBannerDismiss} hitSlop={8}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        renderItem={renderPlan}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: listPaddingTop + (bannerDismissed ? 0 : bannerHeight + 12),
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              onCreatePress={handleCreatePlan}
              onImportPress={handleImportPlan}
            />
          ) : null
        }
        ListHeaderComponent={
          coachBrief ? (
            <View
              style={[
                styles.coachCard,
                {
                  backgroundColor: HEVY.surface,
                  borderColor: HEVY.separator,
                },
              ]}
            >
              <View
                style={[
                  styles.coachIconWrap,
                  { backgroundColor: Colors.light.primary + "14" },
                ]}
              >
                <Feather name="zap" size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.coachCardTextCol}>
                <ThemedText style={styles.coachCardTitle}>
                  {t("plans.coach.title", { defaultValue: "Coach" })}
                </ThemedText>
                <ThemedText
                  style={[styles.coachCardBody, { color: theme.textSecondary }]}
                >
                  {coachBrief}
                </ThemedText>
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: HEVY.pad,
    gap: HEVY.pad,
  },
  planCard: {
    backgroundColor: HEVY.surface,
    borderRadius: HEVY.radiusCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HEVY.separator,
    padding: HEVY.pad,
    position: "relative",
  },
  planName: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: HEVY.textPrimary,
    marginBottom: 4,
    paddingRight: 36,
  },
  planMeta: {
    fontSize: 13,
    fontWeight: "500",
    color: HEVY.textMuted,
  },
  menuBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  exercisePreview: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "400",
    color: HEVY.textSecondary,
    lineHeight: 18,
  },
  coachCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: HEVY.pad,
    borderRadius: HEVY.radiusCard,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: HEVY.pad,
    gap: Spacing.md,
  },
  coachIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  coachCardTextCol: {
    flex: 1,
  },
  coachCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: HEVY.textPrimary,
    marginBottom: Spacing.xs,
  },
  coachCardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing["3xl"],
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.md,
  },
  emptyIconBadge: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    color: HEVY.textPrimary,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  emptyPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    minHeight: 50,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  emptyPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    flexShrink: 1,
  },
  emptySecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    minHeight: 50,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: HEVY.surface,
    gap: Spacing.sm,
  },
  emptySecondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: HEVY.textPrimary,
    flexShrink: 1,
  },
  importTopBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: HEVY.radiusCard,
    padding: 14,
    gap: 10,
  },
  importBannerEmoji: {
    fontSize: 20,
  },
  importBannerContent: {
    flex: 1,
  },
  importBannerTitle: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: HEVY.textPrimary,
  },
  importBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    color: HEVY.textMuted,
  },
  importBannerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 20,
  },
  importBannerButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  importBannerDismiss: {
    position: "absolute",
    top: 6,
    right: 6,
  },
});
