import React, { useCallback, useState } from "react";
import { View, StyleSheet, Image, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, CommonActions, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  UserPreferences,
  getUserPreferences,
  clearAllData,
  getWorkoutPlans,
  getWorkoutHistory,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  isDestructive = false,
  index,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  index: number;
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
    <Animated.View entering={FadeInDown.delay(200 + index * 50).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          animatedStyle,
          styles.settingsItem,
          { backgroundColor: theme.backgroundDefault },
        ]}
        testID={`button-settings-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <View
          style={[
            styles.settingsIcon,
            {
              backgroundColor: isDestructive
                ? Colors.light.error + "20"
                : theme.backgroundSecondary,
            },
          ]}
        >
          <Feather
            name={icon}
            size={20}
            color={isDestructive ? Colors.light.error : theme.textSecondary}
          />
        </View>
        <ThemedText
          style={[
            styles.settingsLabel,
            { color: isDestructive ? Colors.light.error : theme.text },
          ]}
        >
          {label}
        </ThemedText>
        {value ? (
          <ThemedText
            style={[styles.settingsValue, { color: theme.textSecondary }]}
          >
            {value}
          </ThemedText>
        ) : null}
        <Feather
          name="chevron-right"
          size={20}
          color={theme.textSecondary}
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [stats, setStats] = useState({ plans: 0, workouts: 0 });

  const loadData = useCallback(async () => {
    try {
      const [prefs, plans, history] = await Promise.all([
        getUserPreferences(),
        getWorkoutPlans(),
        getWorkoutHistory(),
      ]);
      setPreferences(prefs);
      setStats({ plans: plans.length, workouts: history.length });
    } catch (error) {
      console.error("Error loading profile data:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleResetOnboarding = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Reset Preferences",
      "This will restart the onboarding flow. Your workout plans will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllData();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: "Onboarding" as never }],
                })
              );
            } catch (error) {
              console.error("Error resetting:", error);
            }
          },
        },
      ]
    );
  };

  const getSplitDescription = () => {
    if (!preferences) return "Not set";
    return preferences.splitPreference === "recommended"
      ? "Recommended"
      : "Custom";
  };

  const getExerciseDescription = () => {
    if (!preferences) return "Not set";
    return preferences.exercisePreference === "default"
      ? "Default exercises"
      : "Custom selection";
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={styles.profileHeader}
      >
        <Image
          source={require("../../assets/images/avatar-default.png")}
          style={styles.avatar}
          resizeMode="cover"
        />
        <ThemedText style={styles.greeting}>Fitness Enthusiast</ThemedText>
        <ThemedText style={[styles.statsText, { color: theme.textSecondary }]}>
          {stats.plans} plans created · {stats.workouts} workouts completed
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          Preferences
        </ThemedText>
      </Animated.View>

      <View style={styles.settingsList}>
        <SettingsItem
          icon="calendar"
          label="Workout Days"
          value={
            preferences
              ? `${preferences.workoutDaysPerWeek} days/week`
              : "Not set"
          }
          index={0}
        />
        <SettingsItem
          icon="layout"
          label="Split Type"
          value={getSplitDescription()}
          index={1}
        />
        <SettingsItem
          icon="list"
          label="Exercise Selection"
          value={getExerciseDescription()}
          index={2}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          About
        </ThemedText>
      </Animated.View>

      <View style={styles.settingsList}>
        <SettingsItem icon="info" label="App Version" value="1.0.0" index={3} />
        <SettingsItem
          icon="refresh-cw"
          label="Reset Preferences"
          onPress={handleResetOnboarding}
          isDestructive
          index={4}
        />
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  statsText: {
    fontSize: 14,
  },
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsList: {
    gap: Spacing.sm,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  settingsValue: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
});
