import React, { useState, useMemo} from "react";
import { Platform, StyleSheet, Pressable, View, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { hapticMedium } from "@/lib/safeHaptics";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { isMobilityExercise } from "@/lib/exerciseTaxonomy";
import { saveWorkoutPlan, type WorkoutPlan } from "@/lib/storage";
import { scheduleDataSync } from "@/lib/dataSync";
import { toast } from "@/lib/toast";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CreatePlanFab() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { catalog } = useExerciseCatalog();

  const fabBottom = tabBarHeight + Math.max(insets.bottom, 12) + 12;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const openSheet = () => {
    hapticMedium();
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const goCardio = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("LogCardio");
  };

  const goCreatePlan = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("CreatePlan");
  };

  const goGoalPlan = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("GoalPlan");
  };

  const goImport = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("ImportWorkout");
  };

  // Picks up to 6 stretch/mobility moves, one per muscle group first (for a
  // balanced full-body session) before repeating groups — about 15-20 min at
  // 2 holds each. No duration data exists in the catalog, so the "15-20 min"
  // promise lives in the copy, backed by a hold-count that roughly matches it.
  const goMobility = async () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const mobilityExercises = catalog.filter((c) => isMobilityExercise(c.name));
    if (mobilityExercises.length === 0) {
      toast.error(t("common.loadFailed"));
      return;
    }

    const picked: typeof mobilityExercises = [];
    const seenGroups = new Set<string>();
    for (const ex of mobilityExercises) {
      if (picked.length >= 6) break;
      if (seenGroups.has(ex.muscleGroup)) continue;
      seenGroups.add(ex.muscleGroup);
      picked.push(ex);
    }
    for (const ex of mobilityExercises) {
      if (picked.length >= 6) break;
      if (!picked.includes(ex)) picked.push(ex);
    }

    try {
      const now = new Date().toISOString();
      const sessionName = t("addWorkout.mobilitySession");
      const plan: WorkoutPlan = {
        id: Date.now().toString(),
        name: sessionName,
        daysPerWeek: 1,
        days: [
          {
            dayName: sessionName,
            exercises: picked.map((ex) => ({
              id: ex.id,
              name: ex.name,
              muscleGroup: ex.muscleGroup,
              sets: 2,
              reps: "30-45s",
              equipment: ex.equipment || null,
            })),
          },
        ],
        createdAt: now,
        lastModified: now,
      };
      await saveWorkoutPlan(plan);
      scheduleDataSync();
      navigation.navigate("ActiveWorkout", {
        planId: plan.id,
        planName: plan.name,
        dayIndex: 0,
      });
    } catch (err) {
      console.error("CreatePlanFab: failed to start mobility session", err);
      toast.error(t("common.actionFailed"));
    }
  };

  return (
    <>
      <View
        style={[
          styles.container,
          Platform.OS === "web" ? styles.containerWeb : null,
          { bottom: fabBottom },
        ]}
        pointerEvents="box-none"
      >
        <AnimatedPressable
          onPress={openSheet}
          onPressIn={() => {
            scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
          style={animatedStyle}
          testID="button-fab-create"
          accessibilityRole="button"
          accessibilityLabel={t("addWorkout.fabLabel")}
        >
          <View style={[styles.fab, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={24} color={theme.onChalk} />
          </View>
        </AnimatedPressable>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
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
            <ThemedText style={styles.sheetTitle}>{t("addWorkout.title")}</ThemedText>

            <Pressable style={styles.sheetItem} onPress={goCreatePlan} testID="button-add-create-plan">
              <View style={[styles.sheetIcon, { backgroundColor: theme.primary + "1A" }]}>
                <Feather name="clipboard" size={20} color={theme.chalk} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.createPlan")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.createPlanDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goGoalPlan} testID="button-add-goal-plan">
              <View style={[styles.sheetIcon, { backgroundColor: theme.primary + "1A" }]}>
                <Feather name="target" size={20} color={theme.chalk} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.goalPlan")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.goalPlanDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goMobility} testID="button-add-mobility">
              <View style={[styles.sheetIcon, { backgroundColor: theme.primary + "1A" }]}>
                <Feather name="wind" size={20} color={theme.chalk} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.mobilitySession")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.mobilitySessionDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goCardio} testID="button-add-cardio">
              <View style={[styles.sheetIcon, { backgroundColor: theme.primary + "1A" }]}>
                <ActivityIcon sport="running" size={20} color={theme.chalk} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.logCardio")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.logCardioDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goImport} testID="button-add-import">
              <View style={[styles.sheetIcon, { backgroundColor: theme.primary + "1A" }]}>
                <Feather name="file-text" size={20} color={theme.chalk} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("plans.importBanner.title", { defaultValue: "Plan importieren" })}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("plans.importBanner.subtitle", { defaultValue: "PDF oder Foto → KI-Prüfung" })}
                </ThemedText>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.xl,
    zIndex: 1000,
    elevation: 8,
  },
  containerWeb: {
    position: "fixed" as "absolute",
    zIndex: 9999,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(236,233,225,0.09)",
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCopy: { flex: 1 },
  sheetItemTitle: { fontSize: 16, fontWeight: "600" },
  sheetItemDesc: { fontSize: 13, opacity: 0.65, marginTop: 2 },
});
