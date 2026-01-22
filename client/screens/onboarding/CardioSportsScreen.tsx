import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { useOnboarding } from "@/context/OnboardingContext";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPORTS_OPTIONS = [
  {
    id: "running",
    name: "Running",
    icon: "wind",
  },
  {
    id: "basketball",
    name: "Basketball",
    icon: "target",
  },
  {
    id: "boxing",
    name: "Boxing",
    icon: "zap",
  },
  {
    id: "swimming",
    name: "Swimming",
    icon: "droplet",
  },
  {
    id: "cycling",
    name: "Cycling",
    icon: "navigation",
  },
  {
    id: "soccer",
    name: "Soccer",
    icon: "circle",
  },
  {
    id: "hiit",
    name: "HIIT",
    icon: "activity",
  },
  {
    id: "yoga",
    name: "Yoga",
    icon: "sun",
  },
];

function SportChip({
  sport,
  selected,
  onPress,
  index,
}: {
  sport: (typeof SPORTS_OPTIONS)[0];
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          animatedStyle,
          styles.sportChip,
          {
            backgroundColor: selected
              ? Colors.light.primary
              : theme.backgroundDefault,
            borderColor: selected ? Colors.light.primary : theme.border,
          },
        ]}
        testID={`button-sport-${sport.id}`}
      >
        <Feather
          name={sport.icon as any}
          size={18}
          color={selected ? "#FFFFFF" : theme.textSecondary}
        />
        <ThemedText
          style={[
            styles.sportName,
            { color: selected ? "#FFFFFF" : theme.text },
          ]}
        >
          {sport.name}
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const { theme } = useTheme();
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            {
              backgroundColor:
                index < step ? Colors.light.primary : theme.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function CardioSportsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const { state, setCardioDays } = useOnboarding();
  const [selectedSports, setSelectedSports] = useState<string[]>(
    state.cardioDays || []
  );
  const [wantsCardio, setWantsCardio] = useState<boolean | null>(
    state.cardioDays ? state.cardioDays.length > 0 : null
  );
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleToggleSport = (sportId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSports((prev) =>
      prev.includes(sportId)
        ? prev.filter((s) => s !== sportId)
        : [...prev, sportId]
    );
  };

  const handleWantsCardio = (wants: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWantsCardio(wants);
    if (!wants) {
      setSelectedSports([]);
    }
  };

  const handleContinue = () => {
    setCardioDays(selectedSports);
    navigation.navigate("SplitPreference");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const canContinue = wantsCardio !== null && (wantsCardio === false || selectedSports.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <ProgressBar step={2} total={4} />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.questionContainer}
        >
          <ThemedText style={styles.title}>
            Want to add cardio{"\n"}or sports days?
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Mix training with activities you love
          </ThemedText>
        </Animated.View>

        <View style={styles.choiceContainer}>
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Pressable
              onPress={() => handleWantsCardio(true)}
              style={[
                styles.choiceCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor:
                    wantsCardio === true ? Colors.light.primary : theme.border,
                  borderWidth: wantsCardio === true ? 2 : 1,
                },
              ]}
              testID="button-wants-cardio"
            >
              <View
                style={[
                  styles.choiceIcon,
                  {
                    backgroundColor:
                      wantsCardio === true
                        ? Colors.light.primary + "15"
                        : theme.backgroundSecondary,
                  },
                ]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={
                    wantsCardio === true
                      ? Colors.light.primary
                      : theme.textSecondary
                  }
                />
              </View>
              <View style={styles.choiceText}>
                <ThemedText style={styles.choiceName}>
                  Yes, add some variety
                </ThemedText>
                <ThemedText
                  style={[styles.choiceDesc, { color: theme.textSecondary }]}
                >
                  Include cardio or sports in my week
                </ThemedText>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Pressable
              onPress={() => handleWantsCardio(false)}
              style={[
                styles.choiceCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor:
                    wantsCardio === false ? Colors.light.primary : theme.border,
                  borderWidth: wantsCardio === false ? 2 : 1,
                },
              ]}
              testID="button-no-cardio"
            >
              <View
                style={[
                  styles.choiceIcon,
                  {
                    backgroundColor:
                      wantsCardio === false
                        ? Colors.light.primary + "15"
                        : theme.backgroundSecondary,
                  },
                ]}
              >
                <Feather
                  name="x"
                  size={24}
                  color={
                    wantsCardio === false
                      ? Colors.light.primary
                      : theme.textSecondary
                  }
                />
              </View>
              <View style={styles.choiceText}>
                <ThemedText style={styles.choiceName}>
                  No, just weights
                </ThemedText>
                <ThemedText
                  style={[styles.choiceDesc, { color: theme.textSecondary }]}
                >
                  Focus on strength training only
                </ThemedText>
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {wantsCardio === true ? (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={styles.sportsSection}
          >
            <ThemedText style={styles.sectionTitle}>
              Select your activities
            </ThemedText>
            <ThemedText
              style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
            >
              Choose one or more
            </ThemedText>
            <View style={styles.sportsGrid}>
              {SPORTS_OPTIONS.map((sport, index) => (
                <SportChip
                  key={sport.id}
                  sport={sport}
                  selected={selectedSports.includes(sport.id)}
                  onPress={() => handleToggleSport(sport.id)}
                  index={index}
                />
              ))}
            </View>
          </Animated.View>
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
          testID="button-back"
        >
          <ThemedText style={[styles.backButtonText, { color: theme.text }]}>
            Back
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
          disabled={!canContinue}
          style={[
            animatedButtonStyle,
            styles.continueButtonContainer,
            { opacity: canContinue ? 1 : 0.5 },
          ]}
          testID="button-next"
        >
          <LinearGradient
            colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <ThemedText style={styles.buttonText}>Next</ThemedText>
          </LinearGradient>
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
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["3xl"],
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  questionContainer: {
    marginBottom: Spacing["2xl"],
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
  },
  choiceContainer: {
    gap: Spacing.md,
    marginBottom: Spacing["2xl"],
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  choiceText: {
    flex: 1,
  },
  choiceName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  choiceDesc: {
    fontSize: 13,
  },
  sportsSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  sportChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  sportName: {
    fontSize: 14,
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
});
