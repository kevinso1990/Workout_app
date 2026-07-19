import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import {
  saveWorkoutPlan,
  getUserPreferences,
} from "@/lib/storage";
import { scheduleDataSync } from "@/lib/dataSync";
import { generateWorkoutPlan } from "@/lib/planGeneration";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/safeHaptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DAYS = [1, 2, 3, 4, 5, 6, 7];

function DayPill({
  day,
  selected,
  onPress,
}: {
  day: number;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      testID={`button-day-${day}`}
    >
      {selected ? (
        <View style={[styles.dayPill, { backgroundColor: Colors.light.primary }]}>
          <ThemedText style={styles.dayPillTextSelected}>{day}</ThemedText>
        </View>
      ) : (
        <View
          style={[styles.dayPill, { backgroundColor: theme.backgroundSecondary }]}
        >
          <ThemedText style={[styles.dayPillText, { color: theme.text }]}>
            {day}
          </ThemedText>
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function CreatePlanScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [planName, setPlanName] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleDaySelect = (day: number) => {
    hapticLight();
    setDaysPerWeek(day);
  };

  const handleCreate = async () => {
    if (!planName.trim()) {
      hapticError();
      return;
    }

    setIsLoading(true);
    try {
      const prefs = await getUserPreferences();
      const { plan } = await generateWorkoutPlan({
        frequency: daysPerWeek,
        experience: prefs?.fitnessLevel ?? "beginner",
        goal: prefs?.fitnessGoals?.[0] ?? "build_muscle",
        equipment: prefs?.equipment ?? null,
        focusMuscles: prefs?.focusMuscles,
        planName: planName.trim(),
      });
      await saveWorkoutPlan(plan);
      scheduleDataSync();
      hapticSuccess();
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Main");
      }
    } catch (error) {
      console.error("Error creating plan:", error);
      hapticError();
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = planName.trim().length > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl),
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.section}
      >
        <ThemedText style={styles.label}>{t("planBuilder.newPlan")}</ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder={t("planBuilder.planNamePlaceholder")}
          placeholderTextColor={theme.textSecondary}
          value={planName}
          onChangeText={setPlanName}
          autoFocus={Platform.OS !== "web"}
          testID="input-plan-name"
        />
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.section}
      >
        <ThemedText style={styles.label}>
          {t("createPlan.labelFrequency")}
        </ThemedText>
        <ThemedText
          style={[styles.hint, { color: theme.textSecondary }]}
        >
          {t("createPlan.frequencyHint")}
        </ThemedText>
        <View style={styles.pillsContainer}>
          {DAYS.map((day) => (
            <DayPill
              key={day}
              day={day}
              selected={daysPerWeek === day}
              onPress={() => handleDaySelect(day)}
            />
          ))}
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={styles.previewSection}
      >
        <ThemedText style={styles.label}>{t("createPlan.recommendedSplit")}</ThemedText>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <Feather
            name="info"
            size={16}
            color={Colors.light.primary}
            style={styles.previewIcon}
          />
          <ThemedText
            style={[styles.previewText, { color: theme.textSecondary }]}
          >
            {daysPerWeek === 1
              ? t("createPlan.splitPreview.fullBody")
              : daysPerWeek === 2
                ? t("createPlan.splitPreview.upperLower")
                : daysPerWeek === 3
                  ? t("createPlan.splitPreview.pushPullLegs")
                  : daysPerWeek === 4
                    ? t("createPlan.splitPreview.upperLowerX2")
                    : daysPerWeek === 5
                      ? t("createPlan.splitPreview.pushPullLegsUpperLower")
                      : daysPerWeek === 6
                        ? t("createPlan.splitPreview.pushPullLegsX2")
                        : t("createPlan.splitPreview.fullWeek")}
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        style={styles.buttonSection}
      >
        <AnimatedPressable
          onPress={handleCreate}
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
          disabled={!isValid || isLoading}
          style={[
            animatedButtonStyle,
            { opacity: isValid && !isLoading ? 1 : 0.5 },
          ]}
          testID="button-create-plan"
        >
          <View style={[styles.button, { backgroundColor: Colors.light.primary }]}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.buttonText}>
                {t("plans.createPlan")}
              </ThemedText>
            )}
          </View>
        </AnimatedPressable>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  dayPill: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  dayPillTextSelected: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  previewSection: {
    marginBottom: Spacing["3xl"],
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  previewIcon: {
    marginRight: Spacing.md,
  },
  previewText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonSection: {
    marginTop: "auto",
  },
  button: {
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
});
