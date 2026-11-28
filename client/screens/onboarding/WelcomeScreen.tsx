import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
  FadeInDown,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import { ThemedText } from "@/components/ThemedText";
import { HEVY } from "@/constants/hevyLayout";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const scale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Importing the plan you already train by is the main way in (STRATEGY.md):
  // the import marks onboarding done when it saves. The questionnaire is for
  // people without a plan.
  const handleImport = () => {
    navigation.navigate("ImportWorkout");
  };

  const handleNoPlan = () => {
    navigation.navigate("Equipment");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.iron }]}>
      <View
        style={[
          styles.content,
          {
            ...screenHeaderSafeAreaStyle(insets.top),
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <Animated.View
          entering={FadeInUp.delay(100).duration(600)}
          style={styles.logoWrap}
        >
          <BrandLogo height={140} centered />
        </Animated.View>

        {/* Title + subtitle */}
        <View style={styles.textContainer}>
          <Animated.View entering={FadeInUp.delay(300).duration(600)}>
            <OnboardingHeading
              centered
              title={t("onboarding.welcomeTitle")}
              subtitle={t("onboarding.welcomeTagline")}
              style={{ marginBottom: 0 }}
            />
          </Animated.View>
        </View>

        {/* CTA */}
        <Animated.View
          entering={FadeInDown.delay(550).duration(600)}
          style={styles.buttonContainer}
        >
          <AnimatedPressable
            onPress={handleImport}
            onPressIn={() => {
              scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1, { damping: 15, stiffness: 150 });
            }}
            style={animatedButtonStyle}
            testID="button-import-plan"
          >
            <View style={[styles.button, { backgroundColor: theme.primary }]}>
              <Feather name="camera" size={18} color={theme.onChalk} />
              <ThemedText style={styles.buttonText}>
                {t("onboarding.welcomeImport")}
              </ThemedText>
            </View>
          </AnimatedPressable>
          <ThemedText style={[styles.importHint, { color: theme.textSecondary }]}>
            {t("onboarding.welcomeImportHint")}
          </ThemedText>
          <Pressable
            onPress={handleNoPlan}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              { backgroundColor: pressed ? theme.panelEdge : theme.chipIdle },
            ]}
            testID="button-get-started"
          >
            <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>
              {t("onboarding.welcomeNoPlan")}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  textContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    gap: Spacing.md,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
    fontFamily: "Oswald_700Bold",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
  buttonContainer: {
    paddingBottom: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  importHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  secondaryButton: {
    marginTop: Spacing.xl,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Oswald_600SemiBold",
  },
  buttonText: {
    color: c.onChalk,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Oswald_600SemiBold",
  },
});
