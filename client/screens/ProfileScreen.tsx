import React, { useCallback, useState } from "react";
import { View, StyleSheet, Image, Pressable, Alert, Modal, TextInput, ScrollView, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import { useThemeContext, ThemeMode } from "@/context/ThemeContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  UserPreferences,
  getUserPreferences,
  setUserPreferences,
  clearAllData,
  getWorkoutPlans,
  getWorkoutHistory,
  BodyMeasurement,
  getBodyMeasurements,
  addBodyMeasurement,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function BodyStatsCard({
  latestMeasurement,
  onAddNew,
}: {
  latestMeasurement: BodyMeasurement | null;
  onAddNew: () => void;
}) {
  const { theme } = useTheme();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(400)}
      style={[styles.bodyStatsCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.bodyStatsHeader}>
        <View>
          <ThemedText style={styles.bodyStatsTitle}>Body Stats</ThemedText>
          {latestMeasurement ? (
            <ThemedText style={[styles.bodyStatsDate, { color: theme.textSecondary }]}>
              Last updated: {formatDate(latestMeasurement.date)}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={onAddNew}
          style={[styles.addMeasurementBtn, { backgroundColor: Colors.light.primary + "15" }]}
        >
          <Feather name="plus" size={16} color={Colors.light.primary} />
          <ThemedText style={[styles.addMeasurementText, { color: Colors.light.primary }]}>
            {latestMeasurement ? "Update" : "Add"}
          </ThemedText>
        </Pressable>
      </View>

      {latestMeasurement ? (
        <View style={styles.bodyStatsGrid}>
          {latestMeasurement.weight ? (
            <View style={styles.bodyStatItem}>
              <ThemedText style={styles.bodyStatValue}>{latestMeasurement.weight}</ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>kg</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.bodyFat ? (
            <View style={styles.bodyStatItem}>
              <ThemedText style={styles.bodyStatValue}>{latestMeasurement.bodyFat}%</ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>Body Fat</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.chest ? (
            <View style={styles.bodyStatItem}>
              <ThemedText style={styles.bodyStatValue}>{latestMeasurement.chest}</ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>Chest cm</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.waist ? (
            <View style={styles.bodyStatItem}>
              <ThemedText style={styles.bodyStatValue}>{latestMeasurement.waist}</ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>Waist cm</ThemedText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.bodyStatsEmpty}>
          <Feather name="activity" size={24} color={theme.textSecondary} />
          <ThemedText style={[styles.bodyStatsEmptyText, { color: theme.textSecondary }]}>
            Track your body measurements to see progress over time
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

function AddMeasurementModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (measurement: BodyMeasurement) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");

  const handleSave = () => {
    const measurement: BodyMeasurement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      weight: weight ? parseFloat(weight) : undefined,
      bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      chest: chest ? parseFloat(chest) : undefined,
      waist: waist ? parseFloat(waist) : undefined,
    };
    onSave(measurement);
    setWeight("");
    setBodyFat("");
    setChest("");
    setWaist("");
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.measurementModalOverlay}>
        <View style={[styles.measurementModalContent, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.measurementModalHeader}>
            <ThemedText style={styles.measurementModalTitle}>Add Measurement</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.measurementInputRow}>
              <View style={styles.measurementInputGroup}>
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>Weight (kg)</ThemedText>
                <TextInput
                  style={[styles.measurementInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholder="75"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.measurementInputGroup}>
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>Body Fat %</ThemedText>
                <TextInput
                  style={[styles.measurementInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  keyboardType="decimal-pad"
                  placeholder="15"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>

            <View style={styles.measurementInputRow}>
              <View style={styles.measurementInputGroup}>
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>Chest (cm)</ThemedText>
                <TextInput
                  style={[styles.measurementInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={chest}
                  onChangeText={setChest}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              <View style={styles.measurementInputGroup}>
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>Waist (cm)</ThemedText>
                <TextInput
                  style={[styles.measurementInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={waist}
                  onChangeText={setWaist}
                  keyboardType="decimal-pad"
                  placeholder="80"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
            </View>
          </ScrollView>

          <Pressable onPress={handleSave}>
            <LinearGradient
              colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
              style={styles.measurementSaveButton}
            >
              <ThemedText style={styles.measurementSaveText}>Save Measurement</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}> = [
  { value: "system", icon: "smartphone", label: "System" },
  { value: "light",  icon: "sun",        label: "Light"  },
  { value: "dark",   icon: "moon",       label: "Dark"   },
];

function ThemeToggleCard() {
  const { theme } = useTheme();
  const { mode, setMode } = useThemeContext();

  return (
    <Animated.View
      entering={FadeInDown.delay(160).duration(400)}
      style={[styles.themeCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.themeCardHeader}>
        <View
          style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}
        >
          <Feather name="monitor" size={20} color={Colors.light.primary} />
        </View>
        <ThemedText style={styles.themeCardTitle}>Appearance</ThemedText>
      </View>
      <View style={styles.themeSegments}>
        {THEME_OPTIONS.map(({ value, icon, label }) => {
          const isActive = mode === value;
          return (
            <Pressable
              key={value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMode(value);
              }}
              style={[
                styles.themeSegment,
                {
                  backgroundColor: isActive
                    ? Colors.light.primary + "15"
                    : theme.backgroundSecondary,
                  borderColor: isActive ? Colors.light.primary : theme.border,
                },
              ]}
              testID={`button-theme-${value}`}
            >
              <Feather
                name={icon}
                size={18}
                color={isActive ? Colors.light.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.themeSegmentLabel,
                  { color: isActive ? Colors.light.primary : theme.textSecondary },
                ]}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

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
        {onPress !== undefined ? (
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        ) : null}
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
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [prefs, plans, history, bodyMeasurements] = await Promise.all([
        getUserPreferences(),
        getWorkoutPlans(),
        getWorkoutHistory(),
        getBodyMeasurements(),
      ]);
      setPreferences(prefs);
      setStats({ plans: plans.length, workouts: history.length });
      setMeasurements(bodyMeasurements);
      setRestTimerEnabled(prefs?.restTimerEnabled !== false); // default true
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


  const handleSaveMeasurement = async (measurement: BodyMeasurement) => {
    await addBodyMeasurement(measurement);
    setMeasurements([measurement, ...measurements]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleRestTimer = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestTimerEnabled(value);
    const current = preferences ?? {
      workoutDaysPerWeek: 3,
      splitPreference: "recommended" as const,
      exercisePreference: "default" as const,
    };
    await setUserPreferences({ ...current, restTimerEnabled: value });
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

      <Animated.View
        entering={FadeInDown.delay(150).duration(400)}
        style={[styles.restTimerCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather name="clock" size={20} color={Colors.light.primary} />
        </View>
        <View style={styles.reminderInfo}>
          <ThemedText style={styles.reminderTitle}>Rest Timer</ThemedText>
          <ThemedText style={[styles.reminderSubtitle, { color: theme.textSecondary }]}>
            {restTimerEnabled
              ? "Auto-starts after each set"
              : "Train by feel — no countdown"}
          </ThemedText>
        </View>
        <Switch
          value={restTimerEnabled}
          onValueChange={handleToggleRestTimer}
          trackColor={{ false: theme.border, true: Colors.light.primary }}
          thumbColor="#fff"
          testID="switch-rest-timer"
        />
      </Animated.View>

      <ThemeToggleCard />

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          About
        </ThemedText>
      </Animated.View>

      <View style={styles.settingsList}>
        {/* App Version: informational only — no press handler, no chevron, no animation */}
        <Animated.View
          entering={FadeInDown.delay(350).duration(400)}
          style={[styles.settingsItem, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.settingsIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={20} color={theme.textSecondary} />
          </View>
          <ThemedText style={[styles.settingsLabel, { color: theme.text }]}>App Version</ThemedText>
          <ThemedText style={[styles.settingsValue, { color: theme.textSecondary }]}>1.0.0</ThemedText>
        </Animated.View>

        <SettingsItem
          icon="refresh-cw"
          label="Reset Preferences"
          onPress={handleResetOnboarding}
          isDestructive
          index={4}
        />
      </View>

      <BodyStatsCard
        latestMeasurement={measurements[0] || null}
        onAddNew={() => setShowMeasurementModal(true)}
      />

      <AddMeasurementModal
        visible={showMeasurementModal}
        onClose={() => setShowMeasurementModal(false)}
        onSave={handleSaveMeasurement}
      />
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
  restTimerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  reminderSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  themeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  themeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  themeCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  themeSegments: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  themeSegment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  themeSegmentLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  bodyStatsCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  bodyStatsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  bodyStatsTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  bodyStatsDate: {
    fontSize: 12,
    marginTop: 2,
  },
  addMeasurementBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  addMeasurementText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bodyStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.lg,
  },
  bodyStatItem: {
    alignItems: "center",
    minWidth: 60,
  },
  bodyStatValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  bodyStatLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  bodyStatsEmpty: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  bodyStatsEmptyText: {
    fontSize: 13,
    textAlign: "center",
  },
  measurementModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  measurementModalContent: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
  },
  measurementModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  measurementModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
  },
  measurementInputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  measurementInputGroup: {
    flex: 1,
  },
  measurementInputLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  measurementInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
  },
  measurementSaveButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  measurementSaveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
