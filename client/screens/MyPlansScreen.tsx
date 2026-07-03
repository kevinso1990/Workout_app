import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
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
  saveWorkoutPlan,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import { getApiUrl } from "@/lib/query-client";
import { buildDailyBriefingPayload } from "@/lib/coachHelpers";
import { isCoachTipRenderable } from "@/lib/coachTip";
import { CreatePlanFab } from "@/components/CreatePlanFab";
import { confirmAlert } from "@/lib/confirmAlert";
import { scheduleDataSync } from "@/lib/dataSync";
import { evaluatePlanAdaptationOffer } from "@/lib/planAdaptation";
import { PlanAdaptationBanner } from "@/components/PlanAdaptationBanner";
import { PlanGenerationFallbackBanner } from "@/components/PlanGenerationFallbackBanner";
import { peekPlanGenerationFallbackNotice } from "@/lib/planGenerationFallback";
import type { PerformanceSignal } from "@/lib/planAdaptation";
import {
  evaluateSplitRefreshOffer,
  type SplitRefreshOffer,
} from "@/lib/splitRefreshEvaluation";
import { SplitRefreshBanner } from "@/components/SplitRefreshBanner";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function firstDayExercisePreview(plan: WorkoutPlan): string {
  const names = plan.days[0]?.exercises.map((e) => e.name).filter(Boolean) ?? [];
  return names.join(", ");
}

function PlanCard({
  plan,
  index,
  onViewPlan,
  onOpenMenu,
}: {
  plan: WorkoutPlan;
  index: number;
  onViewPlan: () => void;
  onOpenMenu: () => void;
}) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const exerciseLine = useMemo(() => firstDayExercisePreview(plan), [plan]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(350)}>
      <View style={styles.planCard} testID={`card-plan-${plan.id}`}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onOpenMenu();
          }}
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
            {t("plans.planSummary", {
              workouts: plan.daysPerWeek,
              days: plan.days.length,
            })}
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

/** Cross-platform action menu (works on web, where multi-button Alert is a no-op). */
function PlanActionSheet({
  plan,
  onClose,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
}: {
  plan: WorkoutPlan | null;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const items: {
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
    onPress: () => void;
    destructive?: boolean;
  }[] = [
    { key: "edit", label: t("plans.menu.edit"), icon: "edit-3", onPress: onEdit },
    { key: "rename", label: t("plans.menu.rename"), icon: "type", onPress: onRename },
    { key: "duplicate", label: t("plans.menu.duplicate"), icon: "copy", onPress: onDuplicate },
    {
      key: "delete",
      label: t("plans.menu.delete"),
      icon: "trash-2",
      onPress: onDelete,
      destructive: true,
    },
  ];

  return (
    <Modal
      visible={plan !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <ThemedText style={styles.sheetTitle} numberOfLines={1}>
            {plan?.name}
          </ThemedText>
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.sheetItem,
                pressed && { backgroundColor: theme.backgroundSecondary },
              ]}
              testID={`button-plan-action-${item.key}`}
            >
              <Feather
                name={item.icon}
                size={20}
                color={item.destructive ? Colors.light.error : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetItemText,
                  { color: item.destructive ? Colors.light.error : theme.text },
                ]}
              >
                {item.label}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            style={[styles.sheetCancel, { borderColor: theme.border }]}
            testID="button-plan-action-cancel"
          >
            <ThemedText style={[styles.sheetCancelText, { color: theme.textSecondary }]}>
              {t("plans.menu.cancel")}
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Rename dialog (cross-platform; web window.prompt is unreliable in PWAs). */
function RenamePlanModal({
  plan,
  onClose,
  onSubmit,
}: {
  plan: WorkoutPlan | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (plan) setName(plan.name);
  }, [plan]);

  const trimmed = name.trim();

  return (
    <Modal
      visible={plan !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.renameOverlay} onPress={onClose}>
        <Pressable
          style={[styles.renameCard, { backgroundColor: theme.backgroundDefault }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <ThemedText style={styles.renameTitle}>
            {t("plans.menu.renameTitle")}
          </ThemedText>
          <TextInput
            style={[
              styles.renameInput,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder={t("plans.menu.renamePlaceholder")}
            placeholderTextColor={theme.textSecondary}
            autoFocus
            selectTextOnFocus
            testID="input-rename-plan"
          />
          <View style={styles.renameButtons}>
            <Pressable
              onPress={onClose}
              style={[styles.renameBtn, { borderColor: theme.border }]}
              testID="button-rename-cancel"
            >
              <ThemedText style={[styles.renameBtnText, { color: theme.textSecondary }]}>
                {t("plans.menu.cancel")}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => trimmed && onSubmit(trimmed)}
              disabled={!trimmed}
              style={[
                styles.renameBtn,
                {
                  backgroundColor: Colors.light.primary,
                  borderColor: Colors.light.primary,
                  opacity: trimmed ? 1 : 0.5,
                },
              ]}
              testID="button-rename-save"
            >
              <ThemedText style={[styles.renameBtnText, { color: "#FFFFFF" }]}>
                {t("plans.menu.save")}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
  const [menuPlan, setMenuPlan] = useState<WorkoutPlan | null>(null);
  const [renameTarget, setRenameTarget] = useState<WorkoutPlan | null>(null);
  const [adaptPlan, setAdaptPlan] = useState<WorkoutPlan | null>(null);
  const [adaptSignals, setAdaptSignals] = useState<PerformanceSignal[]>([]);
  const [splitRefreshOffer, setSplitRefreshOffer] = useState<SplitRefreshOffer | null>(null);
  const [showGenFallback, setShowGenFallback] = useState(false);

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
      const history = await getWorkoutHistory();
      const offer = await evaluatePlanAdaptationOffer(loadedPlans, history);
      setAdaptPlan(offer.offer ? offer.plan : null);
      setAdaptSignals(offer.signals);

      if (offer.offer) {
        setSplitRefreshOffer(null);
      } else {
        const splitOffer = await evaluateSplitRefreshOffer(
          loadedPlans,
          history,
          false,
        );
        setSplitRefreshOffer(splitOffer);
      }

      const fallback = await peekPlanGenerationFallbackNotice();
      setShowGenFallback(!!fallback);
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
    if (newPlan) {
      scheduleDataSync();
      loadPlans();
    }
  };

  const handleSubmitRename = async (name: string) => {
    const target = renameTarget;
    setRenameTarget(null);
    if (!target || !name.trim() || name.trim() === target.name) return;
    try {
      await saveWorkoutPlan({
        ...target,
        name: name.trim(),
        lastModified: new Date().toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scheduleDataSync();
      loadPlans();
    } catch (error) {
      console.error("Error renaming plan:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleDeletePlan = async (plan: WorkoutPlan) => {
    const confirmed = await confirmAlert(
      t("plans.deletePlan"),
      t("plans.deleteConfirmNamed", { name: plan.name }),
      {
        confirmText: t("plans.delete"),
        cancelText: t("common.cancel"),
        destructive: true,
      },
    );
    if (!confirmed) return;
    try {
      await deleteWorkoutPlan(plan.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scheduleDataSync();
      loadPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const listPaddingTop = paddingTopUnderHeader(headerHeight, insets.top, Spacing.md);

  const renderPlan = useCallback(
    ({ item, index }: { item: WorkoutPlan; index: number }) => (
      <PlanCard
        plan={item}
        index={index}
        onViewPlan={() => handleViewPlan(item)}
        onOpenMenu={() => setMenuPlan(item)}
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
          <>
            {showGenFallback ? (
              <PlanGenerationFallbackBanner
                onDismiss={() => setShowGenFallback(false)}
              />
            ) : null}
            {adaptPlan ? (
              <PlanAdaptationBanner
                plan={adaptPlan}
                signals={adaptSignals}
                onApplied={async (updated) => {
                  await saveWorkoutPlan(updated);
                  scheduleDataSync();
                  setAdaptPlan(null);
                  loadPlans();
                }}
                onDismiss={() => setAdaptPlan(null)}
              />
            ) : splitRefreshOffer ? (
              <SplitRefreshBanner
                offer={splitRefreshOffer}
                onApplied={async (updated) => {
                  await saveWorkoutPlan(updated);
                  scheduleDataSync();
                  setSplitRefreshOffer(null);
                  loadPlans();
                }}
                onDismiss={() => setSplitRefreshOffer(null)}
              />
            ) : null}
            {coachBrief ? (
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
            ) : null}
          </>
        }
      />
      <CreatePlanFab />

      <PlanActionSheet
        plan={menuPlan}
        onClose={() => setMenuPlan(null)}
        onEdit={() => {
          const p = menuPlan;
          setMenuPlan(null);
          if (p) handleEditPlan(p);
        }}
        onRename={() => {
          const p = menuPlan;
          setMenuPlan(null);
          if (p) setRenameTarget(p);
        }}
        onDuplicate={() => {
          const p = menuPlan;
          setMenuPlan(null);
          if (p) void handleDuplicate(p);
        }}
        onDelete={() => {
          const p = menuPlan;
          setMenuPlan(null);
          if (p) void handleDeletePlan(p);
        }}
      />

      <RenamePlanModal
        plan={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleSubmitRename}
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
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sheetItemText: {
    fontSize: 16,
    fontWeight: "500",
  },
  sheetCancel: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  renameOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: Spacing.xl,
  },
  renameCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.md,
  },
  renameInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  renameButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  renameBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    minWidth: 96,
    alignItems: "center",
  },
  renameBtnText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
