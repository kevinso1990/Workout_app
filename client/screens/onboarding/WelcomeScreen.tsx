import React from "react";
import { View, StyleSheet, Image, Pressable } from "react-native";
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

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handleGetStarted = () => {
    navigation.navigate("FitnessLevel");
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
        <Animated.View
          entering={FadeInUp.delay(200).duration(600)}
          style={styles.illustrationContainer}
        >
          <Image
            source={require("../../../assets/images/onboarding-welcome.png")}
            style={styles.illustration}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.textContainer}>
          <Animated.View entering={FadeInUp.delay(400).duration(600)}>
            <ThemedText style={styles.title}>
              Build Your{"\n"}Perfect Workout
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).duration(600)}>
            <ThemedText
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              Create personalized workout plans tailored to your goals and
              schedule. Start your fitness journey today.
            </ThemedText>
          </Animated.View>
        </View>

        <Animated.View
          entering={FadeInDown.delay(600).duration(600)}
          style={styles.buttonContainer}
        >
          <AnimatedPressable
            onPress={handleGetStarted}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
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
  illustrationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxHeight: 320,
    marginTop: Spacing["3xl"],
  },
  illustration: {
    width: "100%",
    height: "100%",
    maxWidth: 300,
  },
  textContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.lg,
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
