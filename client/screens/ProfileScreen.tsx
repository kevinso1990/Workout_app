import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Image, Pressable, Alert, Modal, TextInput, ScrollView, Switch } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, CommonActions, useNavigation } from "@react-navigation/native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useThemeContext, ThemeMode } from "@/context/ThemeContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import {
  UserPreferences,
  FitnessLevel,
  Equipment,
  getUserPreferences,
  setUserPreferences,
  mergeRestTimerPreference,
  clearAllData,
  getWorkoutPlans,
  getWorkoutHistory,
  BodyMeasurement,
  getBodyMeasurements,
  addBodyMeasurement,
} from "@/lib/storage";
import {
  getCloudUserId,
  setCloudUserId,
  restoreFromCloud,
} from "@/lib/cloudSync";
import { runDataSync } from "@/lib/dataSync";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import * as WebBrowser from "expo-web-browser";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "@/lib/legalLinks";
import { api } from "@/lib/api";
import { setStoredToken } from "@/lib/nativeAuth";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function BodyStatsCard({
  latestMeasurement,
  onAddNew,
}: {
  latestMeasurement: BodyMeasurement | null;
  onAddNew: () => void;
}) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(400)}
      style={[styles.bodyStatsCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.bodyStatsHeader}>
        <View>
          <ThemedText style={styles.bodyStatsTitle}>{t("profile.bodyStatsTitle")}</ThemedText>
          {latestMeasurement ? (
            <ThemedText style={[styles.bodyStatsDate, { color: theme.textSecondary }]}>
              {t("profile.bodyStatsLastUpdated", {
                date: formatDate(latestMeasurement.date),
              })}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={onAddNew}
          style={[styles.addMeasurementBtn, { backgroundColor: Colors.light.primary + "15" }]}
        >
          <Feather name="plus" size={16} color={Colors.light.primary} />
          <ThemedText style={[styles.addMeasurementText, { color: Colors.light.primary }]}>
            {latestMeasurement ? t("profile.bodyStatsUpdate") : t("profile.bodyStatsAdd")}
          </ThemedText>
        </Pressable>
      </View>

      {latestMeasurement ? (
        <View style={styles.bodyStatsGrid}>
          {latestMeasurement.weight ? (
            <View style={styles.bodyStatItem}>
              <ThemedText
                style={styles.bodyStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {latestMeasurement.weight}
              </ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>{t("common.kg")}</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.bodyFat ? (
            <View style={styles.bodyStatItem}>
              <ThemedText
                style={styles.bodyStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {latestMeasurement.bodyFat}%
              </ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>{t("profile.bodyStatsBodyFat")}</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.chest ? (
            <View style={styles.bodyStatItem}>
              <ThemedText
                style={styles.bodyStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {latestMeasurement.chest}
              </ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>{t("profile.bodyStatsChest")}</ThemedText>
            </View>
          ) : null}
          {latestMeasurement.waist ? (
            <View style={styles.bodyStatItem}>
              <ThemedText
                style={styles.bodyStatValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {latestMeasurement.waist}
              </ThemedText>
              <ThemedText style={[styles.bodyStatLabel, { color: theme.textSecondary }]}>{t("profile.bodyStatsWaist")}</ThemedText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.bodyStatsEmpty}>
          <Feather name="activity" size={24} color={theme.textSecondary} />
          <ThemedText style={[styles.bodyStatsEmptyText, { color: theme.textSecondary }]}>
            {t("profile.bodyStatsEmpty")}
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
  const { t } = useTranslation();
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
            <ThemedText style={styles.measurementModalTitle}>{t("profile.addMeasurement")}</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.measurementInputRow}>
              <View style={styles.measurementInputGroup}>
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>{t("profile.weightKg")}</ThemedText>
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
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>{t("profile.bodyFatPercent")}</ThemedText>
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
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>{t("profile.chestCm")}</ThemedText>
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
                <ThemedText style={[styles.measurementInputLabel, { color: theme.textSecondary }]}>{t("profile.waistCm")}</ThemedText>
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
            <View style={[styles.measurementSaveButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.measurementSaveText}>{t("profile.saveMeasurement")}</ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  icon: keyof typeof Feather.glyphMap;
  labelKey: "profile.light" | "profile.dark";
}> = [
  { value: "light", icon: "sun", labelKey: "profile.light" },
  { value: "dark", icon: "moon", labelKey: "profile.dark" },
];

function ThemeToggleCard() {
  const { theme } = useTheme();
  const { mode, setMode } = useThemeContext();
  const { t } = useTranslation();

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
        <ThemedText style={styles.themeCardTitle}>{t("profile.appearance")}</ThemedText>
      </View>
      <View style={styles.themeSegments}>
        {THEME_OPTIONS.map(({ value, icon, labelKey }) => {
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
                {t(labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function LanguageToggleCard() {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();

  const options = [
    { code: "de" as const, label: t("profile.langGerman") },
    { code: "en" as const, label: t("profile.langEnglish") },
  ];

  return (
    <Animated.View
      entering={FadeInDown.delay(165).duration(400)}
      style={[styles.themeCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.themeCardHeader}>
        <View
          style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}
        >
          <Feather name="globe" size={20} color={Colors.light.primary} />
        </View>
        <ThemedText style={styles.themeCardTitle}>{t("profile.language")}</ThemedText>
      </View>
      <View style={styles.themeSegments}>
        {options.map(({ code, label }) => {
          const isActive = i18n.language === code || i18n.language.startsWith(`${code}-`);
          return (
            <Pressable
              key={code}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void i18n.changeLanguage(code);
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
              testID={`button-language-${code}`}
            >
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

const FITNESS_LEVELS: { id: FitnessLevel; labelKey: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "beginner", labelKey: "onboarding.beginner", icon: "target" },
  { id: "intermediate", labelKey: "onboarding.intermediate", icon: "trending-up" },
  { id: "advanced", labelKey: "onboarding.advanced", icon: "award" },
];

function FitnessLevelCard({
  fitnessLevel,
  onSelect,
}: {
  fitnessLevel: FitnessLevel | null | undefined;
  onSelect: (level: FitnessLevel) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInDown.delay(170).duration(400)}
      style={[styles.prefsCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.prefsCardHeader}>
        <View style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather name="trending-up" size={20} color={Colors.light.primary} />
        </View>
        <ThemedText style={styles.prefsCardTitle}>{t("profile.fitnessLevel")}</ThemedText>
      </View>
      <View style={styles.fitnessLevelOptions}>
        {FITNESS_LEVELS.map(({ id, labelKey, icon }) => {
          const isActive = fitnessLevel === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(id);
              }}
              style={[
                styles.fitnessLevelOption,
                {
                  backgroundColor: isActive ? Colors.light.primary + "15" : theme.backgroundSecondary,
                  borderColor: isActive ? Colors.light.primary : theme.border,
                },
              ]}
              testID={`button-fitness-level-${id}`}
            >
              <Feather
                name={icon}
                size={16}
                color={isActive ? Colors.light.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.fitnessLevelLabel,
                  { color: isActive ? Colors.light.primary : theme.textSecondary },
                ]}
              >
                {t(labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const EQUIPMENT_OPTIONS: {
  id: Equipment;
  labelKey: string;
  icon: keyof typeof Feather.glyphMap;
  mciIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { id: "full_gym", labelKey: "profile.equipmentFullGym", icon: "zap" },
  { id: "dumbbells_only", labelKey: "profile.equipmentDumbbells", icon: "disc" },
  {
    id: "kettlebell",
    labelKey: "profile.equipmentKettlebell",
    icon: "anchor",
    mciIcon: "kettlebell",
  },
  { id: "bodyweight", labelKey: "profile.equipmentBodyweight", icon: "user" },
];

function EquipmentCard({
  equipment,
  onSelect,
}: {
  equipment: Equipment | null | undefined;
  onSelect: (equipment: Equipment) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeInDown.delay(185).duration(400)}
      style={[styles.prefsCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.prefsCardHeader}>
        <View style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather name="tool" size={20} color={Colors.light.primary} />
        </View>
        <ThemedText style={styles.prefsCardTitle}>{t("profile.equipment")}</ThemedText>
      </View>
      <View style={styles.equipmentOptions}>
        {EQUIPMENT_OPTIONS.map(({ id, labelKey, icon, mciIcon }) => {
          const isActive = equipment === id;
          const iconColor = isActive ? Colors.light.primary : theme.textSecondary;
          return (
            <Pressable
              key={id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(id);
              }}
              style={[
                styles.equipmentOption,
                {
                  backgroundColor: isActive ? Colors.light.primary + "15" : theme.backgroundSecondary,
                  borderColor: isActive ? Colors.light.primary : theme.border,
                },
              ]}
              testID={`button-equipment-${id}`}
            >
              {mciIcon ? (
                <MaterialCommunityIcons name={mciIcon} size={18} color={iconColor} />
              ) : (
                <Feather name={icon} size={16} color={iconColor} />
              )}
              <ThemedText
                style={[
                  styles.fitnessLevelLabel,
                  { color: isActive ? Colors.light.primary : theme.textSecondary },
                ]}
              >
                {t(labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function CloudBackupCard() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [backupId, setBackupId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    void getCloudUserId().then(setBackupId);
  }, []);

  const handleBackupNow = async () => {
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await runDataSync();
    setBusy(false);
    Alert.alert(
      ok ? t("profile.cloudBackedUpTitle") : t("profile.cloudErrorTitle"),
      ok ? t("profile.cloudBackedUpMessage") : t("profile.cloudErrorMessage"),
    );
  };

  const handleRestore = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setBusy(true);
    await setCloudUserId(code);
    const result = await restoreFromCloud(code);
    setBusy(false);
    setShowRestore(false);
    setCodeInput("");
    if (result.restored) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("profile.cloudRestoredTitle"),
        t("profile.cloudRestoredMessage", {
          historyCount: result.historyCount,
          planCount: result.planCount,
        }),
      );
      if (typeof window !== "undefined" && window.location?.reload) {
        setTimeout(() => window.location.reload(), 800);
      }
    } else {
      Alert.alert(
        t("profile.cloudNotFoundTitle"),
        t("profile.cloudNotFoundMessage"),
      );
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(195).duration(400)}
      style={[styles.prefsCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.prefsCardHeader}>
        <View style={[styles.settingsIcon, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather name="cloud" size={20} color={Colors.light.primary} />
        </View>
        <ThemedText style={styles.prefsCardTitle}>{t("profile.cloudBackupTitle")}</ThemedText>
      </View>

      <ThemedText style={[styles.cloudHint, { color: theme.textSecondary }]}>
        {t("profile.cloudBackupHint")}
      </ThemedText>

      <View style={[styles.cloudCodeBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
        <ThemedText
          style={[styles.cloudCode, { color: theme.text }]}
          selectable
          numberOfLines={1}
          testID="text-backup-code"
        >
          {backupId || "…"}
        </ThemedText>
      </View>

      <View style={styles.cloudButtonsRow}>
        <Pressable
          onPress={handleBackupNow}
          disabled={busy}
          style={[styles.cloudButton, { borderColor: theme.border, opacity: busy ? 0.5 : 1 }]}
          testID="button-backup-now"
        >
          <Feather name="upload-cloud" size={16} color={theme.text} />
          <ThemedText style={[styles.cloudButtonText, { color: theme.text }]}>
            {t("profile.cloudBackupNow")}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowRestore(true);
          }}
          disabled={busy}
          style={[styles.cloudButton, { borderColor: theme.border, opacity: busy ? 0.5 : 1 }]}
          testID="button-restore-open"
        >
          <Feather name="download-cloud" size={16} color={theme.text} />
          <ThemedText style={[styles.cloudButtonText, { color: theme.text }]}>
            {t("profile.cloudRestore")}
          </ThemedText>
        </Pressable>
      </View>

      <Modal visible={showRestore} animationType="fade" transparent>
        <View style={styles.cloudModalOverlay}>
          <View style={[styles.cloudRestoreModal, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={styles.measurementModalTitle}>
              {t("profile.cloudRestoreTitle")}
            </ThemedText>
            <ThemedText style={[styles.cloudHint, { color: theme.textSecondary }]}>
              {t("profile.cloudRestoreHint")}
            </ThemedText>
            <TextInput
              style={[
                styles.cloudInput,
                { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
              ]}
              placeholder={t("profile.cloudBackupCodePlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={codeInput}
              onChangeText={setCodeInput}
              autoCapitalize="none"
              autoCorrect={false}
              testID="input-backup-code"
            />
            <View style={styles.cloudButtonsRow}>
              <Pressable
                onPress={() => {
                  setShowRestore(false);
                  setCodeInput("");
                }}
                style={[styles.cloudButton, { borderColor: theme.border }]}
              >
                <ThemedText style={[styles.cloudButtonText, { color: theme.textSecondary }]}>
                  {t("profile.cancel")}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleRestore}
                disabled={busy || !codeInput.trim()}
                style={[
                  styles.cloudButton,
                  {
                    backgroundColor: Colors.light.primary,
                    borderColor: Colors.light.primary,
                    opacity: busy || !codeInput.trim() ? 0.5 : 1,
                  },
                ]}
                testID="button-restore-confirm"
              >
                <ThemedText style={[styles.cloudButtonText, { color: "#FFFFFF" }]}>
                  {t("profile.cloudLoad")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [stats, setStats] = useState({ plans: 0, workouts: 0 });
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [fitnessLevel, setFitnessLevelState] = useState<FitnessLevel | null | undefined>(null);
  const [equipment, setEquipmentState] = useState<Equipment | null | undefined>(null);

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
      setFitnessLevelState(prefs?.fitnessLevel ?? null);
      setEquipmentState(prefs?.equipment ?? null);
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
      t("profile.resetPreferences"),
      t("profile.resetPreferencesMessage"),
      [
        { text: t("profile.cancel"), style: "cancel" },
        {
          text: t("profile.reset"),
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

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("profile.deleteAccountConfirmTitle"),
      t("profile.deleteAccountConfirmMessage"),
      [
        { text: t("profile.cancel"), style: "cancel" },
        {
          text: t("profile.deleteAccountConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
              await setStoredToken(null);
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
              console.error("Error deleting account:", error);
              Alert.alert(
                t("profile.deleteAccountErrorTitle"),
                t("profile.deleteAccountErrorMessage")
              );
            }
          },
        },
      ]
    );
  };

  const openLegal = (url: string) => {
    Haptics.selectionAsync();
    void WebBrowser.openBrowserAsync(url);
  };


  const handleSaveMeasurement = async (measurement: BodyMeasurement) => {
    await addBodyMeasurement(measurement);
    setMeasurements([measurement, ...measurements]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleToggleRestTimer = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestTimerEnabled(value);
    const updated = mergeRestTimerPreference(preferences, value);
    setPreferences(updated);
    await setUserPreferences(updated);
  };

  const handleSelectFitnessLevel = async (level: FitnessLevel) => {
    setFitnessLevelState(level);
    const current = preferences ?? {
      workoutDaysPerWeek: 3,
      splitPreference: "recommended" as const,
      exercisePreference: "default" as const,
    };
    const updated = { ...current, fitnessLevel: level };
    setPreferences(updated);
    await setUserPreferences(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSelectEquipment = async (value: Equipment) => {
    setEquipmentState(value);
    const current = preferences ?? {
      workoutDaysPerWeek: 3,
      splitPreference: "recommended" as const,
      exercisePreference: "default" as const,
    };
    const updated = { ...current, equipment: value };
    setPreferences(updated);
    await setUserPreferences(updated);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl),
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
        <ThemedText style={styles.greeting}>{t("profile.greeting")}</ThemedText>
        <ThemedText style={[styles.statsText, { color: theme.textSecondary }]}>
          {t("profile.statsSummary", {
            plansLabel: t("profile.plansCreated", { count: stats.plans }),
            workoutsLabel: t("profile.workoutsCompleted", { count: stats.workouts }),
          })}
        </ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          {t("profile.preferences")}
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
          <ThemedText style={styles.reminderTitle}>{t("profile.restTimer")}</ThemedText>
          <ThemedText style={[styles.reminderSubtitle, { color: theme.textSecondary }]}>
            {restTimerEnabled
              ? t("profile.restTimerOn")
              : t("profile.restTimerOff")}
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

      <LanguageToggleCard />

      <FitnessLevelCard
        fitnessLevel={fitnessLevel}
        onSelect={handleSelectFitnessLevel}
      />

      <EquipmentCard equipment={equipment} onSelect={handleSelectEquipment} />

      <CloudBackupCard />

      <SubscriptionCard />

      <Animated.View
        entering={FadeInDown.delay(200).duration(400)}
        style={styles.section}
      >
        <ThemedText
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          {t("profile.about")}
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
          <ThemedText style={[styles.settingsLabel, { color: theme.text }]}>{t("profile.appVersion")}</ThemedText>
          <ThemedText style={[styles.settingsValue, { color: theme.textSecondary }]}>1.0.0</ThemedText>
        </Animated.View>

        <SettingsItem
          icon="refresh-cw"
          label={t("profile.resetPreferences")}
          onPress={handleResetOnboarding}
          isDestructive
          index={4}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(360).duration(400)}
        style={styles.section}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("profile.legal")}
        </ThemedText>
      </Animated.View>

      <View style={styles.settingsList}>
        <SettingsItem
          icon="shield"
          label={t("profile.privacyPolicy")}
          onPress={() => openLegal(PRIVACY_POLICY_URL)}
          index={5}
        />
        <SettingsItem
          icon="file-text"
          label={t("profile.termsOfUse")}
          onPress={() => openLegal(TERMS_OF_USE_URL)}
          index={6}
        />
      </View>

      <Animated.View
        entering={FadeInDown.delay(380).duration(400)}
        style={styles.section}
      >
        <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          {t("profile.account")}
        </ThemedText>
      </Animated.View>

      <View style={styles.settingsList}>
        <SettingsItem
          icon="trash-2"
          label={t("profile.deleteAccount")}
          onPress={handleDeleteAccount}
          isDestructive
          index={7}
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
    flexDirection: "column",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    marginBottom: 16,
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
    borderRadius: BorderRadius.sm,
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
  themeSystemDesc: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  prefsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  prefsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  prefsCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  fitnessLevelOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  fitnessLevelOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  cloudHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  cloudCodeBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  cloudCode: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    letterSpacing: 0.5,
  },
  cloudButtonsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cloudButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  cloudButtonText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  cloudModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  cloudRestoreModal: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cloudInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  equipmentOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  equipmentOption: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  fitnessLevelLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
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
    paddingTop: 12,
    flexShrink: 1,
  },
  bodyStatValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    width: "100%",
    textAlign: "center",
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
