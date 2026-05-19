import React from "react";
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

import { BrandLogo } from "@/components/brand/BrandLogo";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";
import { ThemedText } from "@/components/ThemedText";
import { HEVY } from "@/constants/hevyLayout";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const scale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleGetStarted = () => {
    navigation.navigate("Equipment");
  };

  return (
    <View style={[styles.container, { backgroundColor: HEVY.canvas }]}>
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
              title={"Build Your\nPerfect Workout"}
              subtitle="Personalised plans, smart progression, and everything you need to keep showing up."
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
            onPress={handleGetStarted}
            onPressIn={() => {
              scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1, { damping: 15, stiffness: 150 });
            }}
            style={animatedButtonStyle}
            testID="button-get-started"
          >
            <View style={[styles.button, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.buttonText}>Get Started</ThemedText>
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
    fontFamily: "Montserrat_700Bold",
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
