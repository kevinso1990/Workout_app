import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { useOnboarding } from "@/context/OnboardingContext";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function OptionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  testID,
}: {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  selected: boolean;
  onPress: () => void;
  testID: string;
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

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      testID={testID}
    >
      <View
        style={[
          styles.optionCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: selected ? Colors.light.primary : theme.border,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: selected
                ? Colors.light.primary + "15"
                : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name={icon}
            size={28}
            color={selected ? Colors.light.primary : theme.textSecondary}
          />
        </View>
        <View style={styles.optionTextContainer}>
          <ThemedText style={styles.optionTitle}>{title}</ThemedText>
          <ThemedText
            style={[styles.optionDescription, { color: theme.textSecondary }]}
          >
            {description}
          </ThemedText>
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
      </View>
    </AnimatedPressable>
  );
}

export default function SplitPreferenceScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, setSplitPreference } = useOnboarding();
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSelect = (preference: "choose" | "recommended") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSplitPreference(preference);
  };

  const handleNext = () => {
    if (state.splitPreference) {
      navigation.navigate("ExercisePreference");
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.content,
          {
            ...screenHeaderSafeAreaStyle(insets.top),
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View>
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <ProgressBar showBrand step={3} total={4} style={{ marginBottom: Spacing["4xl"] }} />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(500)}>
            <OnboardingHeading
              title={t("onboarding.splitPreference.title")}
              subtitle={t("onboarding.splitPreference.subtitle")}
            />
          </Animated.View>

          <View style={styles.optionsContainer}>
            <Animated.View entering={FadeInUp.delay(300).duration(500)}>
              <OptionCard
                title={t("onboarding.splitPreference.recommendTitle")}
                description={t("onboarding.splitPreference.recommendDesc")}
                icon="zap"
                selected={state.splitPreference === "recommended"}
                onPress={() => handleSelect("recommended")}
                testID="button-recommended"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(400).duration(500)}>
              <OptionCard
                title={t("onboarding.splitPreference.chooseTitle")}
                description={t("onboarding.splitPreference.chooseDesc")}
                icon="sliders"
                selected={state.splitPreference === "choose"}
                onPress={() => handleSelect("choose")}
                testID="button-choose"
              />
            </Animated.View>
          </View>
        </View>

        <Animated.View
          entering={FadeInUp.delay(500).duration(500)}
          style={styles.buttonsRow}
        >
          <Pressable
            onPress={handleBack}
            style={[styles.backButton, { borderColor: theme.border }]}
            testID="button-back"
          >
            <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
              {t("onboarding.back")}
            </ThemedText>
          </Pressable>

          <AnimatedPressable
            onPress={handleNext}
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
            disabled={!state.splitPreference}
            style={[
              animatedButtonStyle,
              styles.nextButtonContainer,
              { opacity: state.splitPreference ? 1 : 0.5 },
            ]}
            testID="button-next"
          >
            <View style={[styles.nextButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.buttonText}>{t("onboarding.next")}</ThemedText>
            </View>
          </AnimatedPressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "space-between",
  },
  questionContainer: {
    marginBottom: Spacing["3xl"],
  },
  question: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  hint: {
    fontSize: 15,
    textAlign: "center",
  },
  optionsContainer: {
    gap: Spacing.lg,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  buttonsRow: {
    flexDirection: "row",
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
  nextButtonContainer: {
    flex: 1,
  },
  nextButton: {
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
