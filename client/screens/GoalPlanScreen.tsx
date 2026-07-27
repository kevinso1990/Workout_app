import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { toast } from "@/lib/toast";
import { generateWorkoutPlan } from "@/lib/planGeneration";
import {
  saveWorkoutPlan,
  getUserPreferences,
  type FitnessLevel,
  type FitnessGoal,
  type Equipment,
} from "@/lib/storage";

const MAX_GOAL_LENGTH = 200;
const FREQUENCY_OPTIONS = [2, 3, 4, 5] as const;

/** Suggestion chip i18n keys — prefill the goal text field on tap. */
const SUGGESTION_KEYS = [
  "goalPlan.suggestions.hipMobility",
  "goalPlan.suggestions.shoulderMobility",
  "goalPlan.suggestions.lowerBack",
  "goalPlan.suggestions.fullBodyMobility",
  "goalPlan.suggestions.hamstrings",
] as const;

/**
 * Maps free text to the closest structured goal enum the API still requires.
 * The free text itself drives generation; this is just a sensible default.
 */
function inferGoalEnum(text: string): FitnessGoal {
  const t = text.toLowerCase();
  if (/(stärk|strength|stronger|kraft|kräftig)/.test(t)) return "get_stronger";
  if (/(abnehm|fett|fat|lose|schlank|definier)/.test(t)) return "lose_fat";
  return "build_muscle";
}

export default function GoalPlanScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [goalText, setGoalText] = useState("");
  const [frequency, setFrequency] = useState<number>(3);
  const [experience, setExperience] = useState<FitnessLevel>("intermediate");
  const [equipment, setEquipment] = useState<Equipment | null>("full_gym");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seed frequency / experience / equipment from the user's saved preferences so
  // the generated plan matches how they normally train.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await getUserPreferences();
      if (cancelled || !prefs) return;
      if (prefs.workoutDaysPerWeek) setFrequency(prefs.workoutDaysPerWeek);
      if (prefs.fitnessLevel) setExperience(prefs.fitnessLevel);
      if (prefs.equipment) setEquipment(prefs.equipment);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  const trimmed = goalText.trim();
  const canGenerate = trimmed.length >= 3 && !isLoading;

  const handleGenerate = useCallback(async () => {
    if (trimmed.length < 3) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setLoadingText(t("goalPlan.loadingBuilding"));
    loadingTimer.current = setTimeout(
      () => setLoadingText(t("goalPlan.loadingAlmost")),
      2600,
    );

    try {
      const { plan, source } = await generateWorkoutPlan({
        frequency,
        experience,
        goal: inferGoalEnum(trimmed),
        equipment,
        goalText: trimmed,
        planName: trimmed.length > 40 ? trimmed.slice(0, 40).trim() : trimmed,
      });

      if (loadingTimer.current) clearTimeout(loadingTimer.current);

      // A template fallback means the AI never saw the goal — saving it would
      // hand the user a generic plan that ignores what they asked for. Treat it
      // as a soft failure and let them retry instead of silently misleading.
      if (source !== "ai") {
        setIsLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        toast.error(t("goalPlan.aiUnavailable"));
        return;
      }

      await saveWorkoutPlan(plan);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t("goalPlan.created"));
      navigation.dispatch(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main", state: { routes: [{ name: "MyPlans" }], index: 0 } },
            { name: "PlanDetail", params: { planId: plan.id } },
          ],
        }),
      );
    } catch (err) {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      console.error("[GoalPlanScreen] generation failed:", err);
      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(t("goalPlan.failed"));
    }
  }, [trimmed, frequency, experience, equipment, navigation, t]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.backgroundRoot }]}>
        <Animated.View entering={FadeIn.duration(320)} style={styles.loadingInner}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.light.primary + "15" }]}>
            <Feather name="target" size={44} color={Colors.light.primary} />
          </View>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            {loadingText}
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl),
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.headerBlock}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.light.primary + "15" }]}>
            <Feather name="target" size={40} color={Colors.light.primary} />
          </View>
          <ThemedText style={styles.title}>{t("goalPlan.title")}</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {t("goalPlan.subtitle")}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {t("goalPlan.inputLabel")}
          </ThemedText>
          <TextInput
            value={goalText}
            onChangeText={(v) => setGoalText(v.slice(0, MAX_GOAL_LENGTH))}
            placeholder={t("goalPlan.placeholder")}
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
            ]}
          />
          <ThemedText style={[styles.counter, { color: theme.textSecondary }]}>
            {trimmed.length}/{MAX_GOAL_LENGTH}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={styles.chipWrap}>
          {SUGGESTION_KEYS.map((key) => {
            const label = t(key);
            return (
              <Pressable
                key={key}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setGoalText(label);
                }}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
              >
                <ThemedText style={[styles.chipText, { color: theme.text }]}>{label}</ThemedText>
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(290).duration(400)} style={styles.freqBlock}>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {t("goalPlan.daysLabel")}
          </ThemedText>
          <View style={styles.freqRow}>
            {FREQUENCY_OPTIONS.map((n) => {
              const active = frequency === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setFrequency(n);
                  }}
                  style={[
                    styles.freqChip,
                    {
                      borderColor: active ? Colors.light.primary : theme.border,
                      backgroundColor: active ? Colors.light.primary + "15" : theme.backgroundDefault,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.freqChipText,
                      { color: active ? Colors.light.primary : theme.text },
                    ]}
                  >
                    {n}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(360).duration(400)}>
          <Pressable
            onPress={handleGenerate}
            disabled={!canGenerate}
            style={[styles.generateBtn, !canGenerate && { opacity: 0.5 }]}
            testID="button-generate-goal-plan"
          >
            <Feather name="cpu" size={18} color="#FFFFFF" />
            <ThemedText style={styles.generateBtnText}>{t("goalPlan.generate")}</ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  headerBlock: {
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  counter: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  freqBlock: {
    gap: 0,
  },
  freqRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  freqChip: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  freqChipText: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.primary,
    marginTop: Spacing.sm,
  },
  generateBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  loadingInner: {
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
