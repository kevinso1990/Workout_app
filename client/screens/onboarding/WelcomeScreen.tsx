import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
  FadeInDown,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";

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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {/* Branded gradient hero — no external image dependency */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(600)}
          style={styles.heroWrapper}
        >
          <LinearGradient
            colors={[Colors.light.primary + "28", Colors.light.primaryGradientEnd + "12"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.iconRow}>
              <View
                style={[
                  styles.iconBubbleSm,
                  { backgroundColor: Colors.light.primary + "22" },
                ]}
              >
                <Feather name="activity" size={26} color={Colors.light.primary} />
              </View>

              <View style={[styles.iconBubbleLg, { backgroundColor: Colors.light.primary }]}>
                <Feather name="zap" size={38} color="#FFFFFF" />
              </View>

              <View
                style={[
                  styles.iconBubbleSm,
                  { backgroundColor: Colors.light.primary + "22" },
                ]}
              >
                <Feather name="trending-up" size={26} color={Colors.light.primary} />
              </View>
            </View>

            <ThemedText style={styles.heroAppName}>TrackYourLift</ThemedText>
          </LinearGradient>
        </Animated.View>

        {/* Title + subtitle */}
        <View style={styles.textContainer}>
          <Animated.View entering={FadeInUp.delay(300).duration(600)}>
            <ThemedText style={styles.title}>
              Build Your{"\n"}Perfect Workout
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(420).duration(600)}>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Personalised plans, smart progression, and everything you need to keep showing up.
            </ThemedText>
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
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <ThemedText style={styles.buttonText}>Get Started</ThemedText>
            </LinearGradient>
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
  heroWrapper: {
    flex: 1,
    maxHeight: 300,
    marginTop: Spacing["2xl"],
  },
  heroCard: {
    flex: 1,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingVertical: Spacing["3xl"],
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  iconBubbleSm: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubbleLg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  heroAppName: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    color: Colors.light.primary,
    letterSpacing: 3,
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
