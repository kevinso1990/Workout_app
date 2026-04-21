import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
        <Animated.View entering={FadeInUp.delay(100).duration(600)}>
          <Image
            source={require("../../../assets/images/icon.png")}
            style={{ width: 160, height: 160, borderRadius: 32, alignSelf: "center", marginBottom: 16 }}
            resizeMode="contain"
          />
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
    justifyContent: "center",
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
