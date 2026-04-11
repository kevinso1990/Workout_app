import React, { useCallback, useState, useRef } from "react";
import { View, StyleSheet, Image, Pressable, Alert, Modal, TextInput, ScrollView, Switch, Platform } from "react-native";
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
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  UserPreferences,
  getUserPreferences,
  clearAllData,
  getWorkoutPlans,
  getWorkoutHistory,
  BodyMeasurement,
  getBodyMeasurements,
  addBodyMeasurement,
} from "@/lib/storage";
import {
  ReminderSettings,
  getReminderSettings,
  saveReminderSettings,
  scheduleWorkoutReminders,
  requestNotificationPermissions,
  analyzeWorkoutPatterns,
  getDayName,
} from "@/lib/notifications";

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
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: false,
    preferredTime: "09:00",
    weekdays: [1, 2, 3, 4, 5],
  });
  const [workoutInsight, setWorkoutInsight] = useState<string>("");

  const loadData = useCallback(async () => {
    try {
      const [prefs, plans, history, bodyMeasurements, reminders, patterns] = await Promise.all([
        getUserPreferences(),
        getWorkoutPlans(),
        getWorkoutHistory(),
        getBodyMeasurements(),
        getReminderSettings(),
        analyzeWorkoutPatterns(),
      ]);
      setPreferences(prefs);
      setStats({ plans: plans.length, workouts: history.length });
      setMeasurements(bodyMeasurements);
      setReminderSettings(reminders);
      
      if (patterns.lastWorkoutDaysAgo >= 0) {
        if (patterns.lastWorkoutDaysAgo === 0) {
          setWorkoutInsight("You trained today! Great job!");
        } else if (patterns.lastWorkoutDaysAgo === 1) {
          setWorkoutInsight("Last workout was yesterday");
        } else {
          setWorkoutInsight(`${patterns.lastWorkoutDaysAgo} days since last workout`);
        }
      }
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

  const handleToggleReminders = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (value && Platform.OS !== "web") {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert(
          "Notifications Required",
          "Please enable notifications in your device settings to receive workout reminders."
        );
        return;
      }
    }

    const newSettings = { ...reminderSettings, enabled: value };
    setReminderSettings(newSettings);
    await saveReminderSettings(newSettings);
    
    if (value) {
      await scheduleWorkoutReminders(newSettings);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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
      </View>

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          Notifications
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(250).duration(400)}
        style={[styles.reminderCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.reminderHeader}>
          <View style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}>
            <Feather name="bell" size={20} color={Colors.light.primary} />
          </View>
          <View style={styles.reminderInfo}>
            <ThemedText style={styles.reminderTitle}>Workout Reminders</ThemedText>
            <ThemedText style={[styles.reminderSubtitle, { color: theme.textSecondary }]}>
              {reminderSettings.enabled
                ? `Daily at ${reminderSettings.preferredTime}`
                : "Get motivated to train"}
            </ThemedText>
          </View>
          <Switch
            value={reminderSettings.enabled}
            onValueChange={handleToggleReminders}
            trackColor={{ false: theme.border, true: Colors.light.primary }}
            thumbColor="#fff"
            testID="switch-reminders"
          />
        </View>
        {workoutInsight ? (
          <View style={[styles.insightBadge, { backgroundColor: Colors.light.primary + "10" }]}>
            <Feather name="activity" size={14} color={Colors.light.primary} />
            <ThemedText style={[styles.insightText, { color: Colors.light.primary }]}>
              {workoutInsight}
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>

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
  reminderCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
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
  insightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: "flex-start",
  },
  insightText: {
    fontSize: 13,
    fontWeight: "500",
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
