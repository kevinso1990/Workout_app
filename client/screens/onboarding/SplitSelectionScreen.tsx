import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import { ThemedText } from "@/components/ThemedText";
import { HEVY } from "@/constants/hevyLayout";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { useOnboarding } from "@/context/OnboardingContext";
import {
  setOnboardingComplete,
  setUserPreferences,
  saveWorkoutPlan,
} from "@/lib/storage";
import { scheduleDataSync } from "@/lib/dataSync";
import { generateWorkoutPlan } from "@/lib/planGeneration";
import {
  getRecommendedSplit,
  SPLIT_OPTIONS,
  type SplitOption,
} from "@/lib/onboardingUtils";
import { resetToRootMain } from "@/lib/navigationHelpers";
import { hapticLight, hapticSuccess, hapticError } from "@/lib/safeHaptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const isWeb = Platform.OS === "web";
const CardShell = isWeb ? View : Animated.View;
const PreviewShell = isWeb ? View : Animated.View;

const DAY_NAME_KEYS: Record<string, string> = {
  Push: "push",
  Pull: "pull",
  Legs: "legs",
  Upper: "upper",
  Lower: "lower",
  Chest: "chest",
  Back: "back",
  Shoulders: "shoulders",
  Arms: "arms",
};

/** Translates a split day-type label for display. `dayName` also doubles as an
 * exercise-selection key elsewhere, so only the rendered label is translated —
 * the underlying data stays in English. Handles "Full Body A"/"B" variants. */
function translateDayLabel(t: (key: string, opts?: any) => string, day: string): string {
  const fullBodyMatch = day.match(/^Full Body( [ABC])?$/);
  if (fullBodyMatch) {
    return t("onboarding.dayNames.fullBody", { defaultValue: "Full Body" }) + (fullBodyMatch[1] ?? "");
  }
  const key = DAY_NAME_KEYS[day];
  if (!key) return day;
  return t(`onboarding.dayNames.${key}`, { defaultValue: day });
}


function SplitCard({
  split,
  selected,
  disabled,
  recommended,
  onPress,
  index,
}: {
  split: SplitOption;
  selected: boolean;
  disabled: boolean;
  recommended: boolean;
  onPress: () => void;
  index: number;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <CardShell
      {...(isWeb
        ? {}
        : { entering: FadeInDown.delay(100 + index * 80).duration(400) })}
    >
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          animatedStyle,
          styles.splitCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: selected ? Colors.light.primary : recommended ? Colors.light.primary + "55" : theme.border,
            borderWidth: selected ? 2 : recommended ? 1.5 : 1,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
        testID={`button-split-${split.id}`}
      >
        {/* Recommended badge — shown even when not yet selected */}
        {recommended ? (
          <View style={styles.recommendedBadgeWrap}>
            <View style={[styles.recommendedBadge, { backgroundColor: Colors.light.primary }]}>
              <Feather name="star" size={10} color="#fff" />
              <ThemedText style={styles.recommendedBadgeText}>
                {t("onboarding.recommended", { defaultValue: "Recommended" })}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.splitIcon,
            {
              backgroundColor: selected
                ? Colors.light.primary + "15"
                : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name={split.icon as any}
            size={24}
            color={selected ? Colors.light.primary : theme.textSecondary}
          />
        </View>
        <View style={styles.splitInfo}>
          <ThemedText style={styles.splitName}>
            {t(`onboarding.splitOptions.${split.id}.name`, { defaultValue: split.name })}
          </ThemedText>
          <ThemedText
            style={[styles.splitDescription, { color: theme.textSecondary }]}
          >
            {t(`onboarding.splitOptions.${split.id}.description`, { defaultValue: split.description })}
          </ThemedText>
          <View style={styles.daysPreview}>
            {split.days.map((day, i) => (
              <View
                key={i}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected
                      ? Colors.light.primary + "20"
                      : theme.backgroundSecondary,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayChipText,
                    {
                      color: selected
                        ? Colors.light.primary
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {translateDayLabel(t, day)}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
        <View
          style={[
            styles.radioOuter,
            {
              borderColor: selected ? Colors.light.primary : theme.border,
            },
          ]}
        >
          {selected ? (
            <View
              style={[
                styles.radioInner,
                { backgroundColor: Colors.light.primary },
              ]}
            />
          ) : null}
        </View>
      </AnimatedPressable>
    </CardShell>
  );
}

export default function SplitSelectionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, getPreferences } = useOnboarding();

  const recommendedSplitId = getRecommendedSplit(
    state.fitnessLevel,
    state.workoutDaysPerWeek,
    state.fitnessGoals,
  );

  // Pre-select the recommended split so inexperienced users can just tap "Create Plan"
  const [selectedSplit, setSelectedSplit] = useState<string | null>(recommendedSplitId);
  const [isLoading, setIsLoading] = useState(false);
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSplitSelect = (splitId: string) => {
    hapticLight();
    setSelectedSplit(splitId);
  };

  /** Marks onboarding done and lands the user on the main app. */
  const finishToMain = async () => {
    await setOnboardingComplete(true);
    scheduleDataSync();
    if (!resetToRootMain()) {
      navigation.getParent()?.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Main" }],
        }),
      );
    }
  };

  const handleContinue = async () => {
    if (!selectedSplit) return;

    setIsLoading(true);
    try {
      await setUserPreferences(getPreferences());

      const { plan } = await generateWorkoutPlan({
        frequency: state.workoutDaysPerWeek,
        experience: state.fitnessLevel ?? "beginner",
        goal: state.fitnessGoals[0] ?? "build_muscle",
        equipment: state.equipment,
        focusMuscles: state.focusMuscles,
        splitId: selectedSplit,
      });

      await saveWorkoutPlan(plan);
      hapticSuccess();
      await finishToMain();
    } catch (error) {
      // Never leave the user stranded at the end of onboarding with a silent
      // failure — they answered eight screens to get here. Explain it and
      // always offer a way forward (retry, or continue and create a plan later
      // from the Plans screen).
      console.error("Onboarding plan creation failed:", error);
      hapticError();
      Alert.alert(
        t("onboarding.planFailedTitle"),
        t("onboarding.planFailedMessage"),
        [
          {
            text: t("onboarding.planFailedRetry"),
            onPress: () => void handleContinue(),
          },
          {
            text: t("onboarding.planFailedSkip"),
            style: "cancel",
            onPress: () => void finishToMain(),
          },
        ],
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: HEVY.canvas }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            ...screenHeaderSafeAreaStyle(insets.top),
            paddingBottom: insets.bottom + Spacing.xl + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo height={36} style={{ marginBottom: Spacing.lg }} />
        <Animated.View entering={FadeInDown.duration(400)}>
          <OnboardingHeading
            title={t("onboarding.splitTitle")}
            subtitle={t("onboarding.splitSubtitle", {
              days: state.workoutDaysPerWeek,
            })}
          />
        </Animated.View>

        <View style={styles.optionsContainer}>
          {SPLIT_OPTIONS.map((split, index) => (
            <SplitCard
              key={split.id}
              split={split}
              selected={selectedSplit === split.id}
              disabled={split.minDays > state.workoutDaysPerWeek}
              recommended={split.id === recommendedSplitId && split.minDays <= state.workoutDaysPerWeek}
              onPress={() => handleSplitSelect(split.id)}
              index={index}
            />
          ))}
        </View>

        {selectedSplit ? (
          <PreviewShell
            {...(isWeb ? {} : { entering: FadeInDown.duration(300) })}
            style={styles.previewSection}
          >
            <ThemedText style={styles.previewTitle}>{t("onboarding.splitSchedule")}</ThemedText>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              {(() => {
                const split = SPLIT_OPTIONS.find(
                  (s) => s.id === selectedSplit
                );
                if (!split) return null;
                const rawDays: string[] = [];
                for (let i = 0; i < state.workoutDaysPerWeek; i++) {
                  rawDays.push(split.days[i % split.days.length]);
                }
                const totalFb = rawDays.filter((d) => d === "Full Body").length;
                let fbIdx = 0;
                const displayDays = rawDays.map((d) => {
                  if (d === "Full Body") {
                    const label = totalFb > 1 ? `Full Body ${["A", "B", "C"][fbIdx % 3]}` : "Full Body";
                    fbIdx++;
                    return label;
                  }
                  return d;
                });
                return displayDays.map((day, i) => (
                  <View key={i} style={styles.previewDay}>
                    <View
                      style={[
                        styles.previewDayNumber,
                        { backgroundColor: Colors.light.primary + "15" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.previewDayNumberText,
                          { color: Colors.light.primary },
                        ]}
                      >
                        {i + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.previewDayName}>{translateDayLabel(t, day)}</ThemedText>
                  </View>
                ));
              })()}
            </View>
          </PreviewShell>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.backgroundRoot,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { borderColor: theme.border }]}
          disabled={isLoading}
          testID="button-back"
        >
          <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
            {t("onboarding.back")}
          </ThemedText>
        </Pressable>

        <AnimatedPressable
          onPress={handleContinue}
          onPressIn={() => {
            buttonScale.value = withSpring(0.96, {
              damping: 15,
              stiffness: 150,
            });
          }}
          onPressOut={() => {
            buttonScale.value = withSpring(1, {
              damping: 15,
              stiffness: 150,
            });
          }}
          disabled={!selectedSplit || isLoading}
          style={[
            animatedButtonStyle,
            styles.continueButtonContainer,
            { opacity: selectedSplit && !isLoading ? 1 : 0.5 },
          ]}
          testID="button-continue"
        >
          <View style={[styles.continueButton, { backgroundColor: Colors.light.primary }]}>
            {isLoading ? (
              // Generating can take a few seconds — say what's happening so the
              // wait doesn't read as "stuck".
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>
                  {t("onboarding.splitCreatingPlan")}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.buttonText}>{t("onboarding.splitCreatePlan")}</ThemedText>
            )}
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing["2xl"],
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  splitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  recommendedBadgeWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 1,
  },
  recommendedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  recommendedBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  splitIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  splitInfo: {
    flex: 1,
  },
  splitName: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  splitDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  daysPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  dayChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  dayChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
    marginTop: Spacing.xs,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  previewSection: {
    marginTop: Spacing["2xl"],
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.md,
  },
  previewCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  previewDay: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewDayNumber: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  previewDayNumberText: {
    fontSize: 13,
    fontWeight: "600",
  },
  previewDayName: {
    fontSize: 15,
    fontWeight: "500",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  backButton: {
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  continueButtonContainer: {
    flex: 1,
  },
  continueButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
