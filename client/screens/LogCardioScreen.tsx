import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { SliderWithTicks } from "@/components/SliderWithTicks";
import { Spacing, BorderRadius } from "@/constants/theme";
import { HEVY, hevyHeaderInsets } from "@/constants/hevyLayout";
import {
  addWorkoutSession,
  type CardioSportType,
  type WorkoutSession,
} from "@/lib/storage";
import { isoFromDateKey } from "@/lib/workoutCalendar";
import { scheduleDataSync, scheduleSessionSync } from "@/lib/dataSync";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTheme } from "@/hooks/useTheme";

const SPORTS: CardioSportType[] = [
  "running",
  "football",
  "tennis",
  "cycling",
  "swimming",
  "boxing",
  "custom",
];

// Cardio has its own warm identity in the app (amber, mirrored from the
// calendar's cardio markers) — using it here instead of the muted slate
// primary gives the screen energy and a distinct feel.
const CARDIO_ACCENT = "#D97706";
const CARDIO_SOFT = "#FEF3C7";
const CARDIO_ACCENT_DARK = "#92400E";

const SPORT_EMOJI: Record<CardioSportType, string> = {
  running: "🏃",
  football: "⚽",
  tennis: "🎾",
  cycling: "🚴",
  swimming: "🏊",
  boxing: "🥊",
  custom: "✨",
};

/** Effort tier → descriptive label key + color (green → amber → red). */
function effortMeta(rpe: number): { key: string; color: string } {
  if (rpe <= 3) return { key: "effortEasy", color: "#16A34A" };
  if (rpe <= 6) return { key: "effortModerate", color: CARDIO_ACCENT };
  if (rpe <= 8) return { key: "effortHard", color: "#EA580C" };
  return { key: "effortMax", color: "#DC2626" };
}

type LogCardioRoute = RouteProp<RootStackParamList, "LogCardio">;

export default function LogCardioScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<LogCardioRoute>();

  const [sport, setSport] = useState<CardioSportType>("running");
  const [customLabel, setCustomLabel] = useState("");
  const [duration, setDuration] = useState("45");
  const [distance, setDistance] = useState("");
  const [rpe, setRpe] = useState(6);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const completedAt = useMemo(() => {
    const key = route.params?.prefilledDate;
    if (key) return isoFromDateKey(key, 18);
    return new Date().toISOString();
  }, [route.params?.prefilledDate]);

  const sportLabel = (s: CardioSportType) => t(`calendar.sports.${s}`);
  const effort = effortMeta(rpe);

  const handleSave = async () => {
    const durationMinutes = parseInt(duration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      Alert.alert(t("logCardio.errorTitle"), t("logCardio.invalidDuration"));
      return;
    }
    if (sport === "custom" && !customLabel.trim()) {
      Alert.alert(t("logCardio.errorTitle"), t("logCardio.customNameRequired"));
      return;
    }

    const distanceKm = distance.trim()
      ? parseFloat(distance.replace(",", "."))
      : null;
    if (distance.trim() && (!Number.isFinite(distanceKm!) || distanceKm! < 0)) {
      Alert.alert(t("logCardio.errorTitle"), t("logCardio.invalidDistance"));
      return;
    }

    setSaving(true);
    try {
      const displayName =
        sport === "custom" ? customLabel.trim() : sportLabel(sport);

      const session: WorkoutSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        planId: "",
        planName: displayName,
        dayName: displayName,
        completedAt,
        exercises: [],
        duration: durationMinutes,
        workoutType: "cardio",
        cardio: {
          sport,
          sportLabel: sport === "custom" ? customLabel.trim() : undefined,
          durationMinutes,
          distanceKm: distanceKm ?? null,
          rpe,
          notes: notes.trim() || null,
        },
      };

      await addWorkoutSession(session);
      void scheduleSessionSync(session).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch {
      Alert.alert(t("logCardio.errorTitle"), t("logCardio.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: HEVY.canvas }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          ...hevyHeaderInsets(insets.top),
          paddingBottom: Spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.heroRow}>
          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroEmoji}>{SPORT_EMOJI[sport]}</ThemedText>
          </View>
          <View style={styles.heroText}>
            <ThemedText style={styles.title}>{t("logCardio.title")}</ThemedText>
            <ThemedText style={styles.subtitle}>{t("logCardio.subtitle")}</ThemedText>
          </View>
        </View>

        <ThemedText style={styles.label}>{t("logCardio.sport")}</ThemedText>
        <View style={styles.chips}>
          {SPORTS.map((s) => {
            const active = sport === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSport(s);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <ThemedText style={styles.chipEmoji}>{SPORT_EMOJI[s]}</ThemedText>
                <ThemedText
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {sportLabel(s)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {sport === "custom" ? (
          <View style={styles.card}>
            <ThemedText style={styles.fieldLabel}>
              {t("logCardio.customName")}
            </ThemedText>
            <View style={[styles.inputWrap, { borderColor: theme.border }]}>
              <Feather name="edit-3" size={16} color={CARDIO_ACCENT} />
              <TextInput
                value={customLabel}
                onChangeText={setCustomLabel}
                placeholder={t("logCardio.customNamePlaceholder")}
                placeholderTextColor={theme.textSecondary}
                style={[styles.inputText, { color: theme.text }]}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={styles.metricCol}>
              <ThemedText style={styles.fieldLabel}>
                {t("logCardio.durationShort")}
              </ThemedText>
              <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                <Feather name="clock" size={16} color={CARDIO_ACCENT} />
                <TextInput
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholder="45"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.inputNumber, { color: theme.text }]}
                />
                <ThemedText style={styles.unit}>min</ThemedText>
              </View>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />

            <View style={styles.metricCol}>
              <View style={styles.fieldLabelRow}>
                <ThemedText style={styles.fieldLabel}>
                  {t("logCardio.distanceShort")}
                </ThemedText>
                <ThemedText style={styles.optionalTag}>
                  {t("logCardio.optional")}
                </ThemedText>
              </View>
              <View style={[styles.inputWrap, { borderColor: theme.border }]}>
                <Feather name="map-pin" size={16} color={CARDIO_ACCENT} />
                <TextInput
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  placeholder="5,2"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.inputNumber, { color: theme.text }]}
                />
                <ThemedText style={styles.unit}>km</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rpeHeader}>
            <ThemedText style={styles.fieldLabel}>{t("logCardio.rpe")}</ThemedText>
            <View style={[styles.effortBadge, { backgroundColor: effort.color + "1A" }]}>
              <ThemedText style={[styles.effortBadgeText, { color: effort.color }]}>
                {rpe}/10 · {t(`logCardio.${effort.key}`)}
              </ThemedText>
            </View>
          </View>
          <SliderWithTicks
            min={1}
            max={10}
            step={1}
            value={rpe}
            onValueChange={setRpe}
            minimumTrackTintColor={effort.color}
            maximumTrackTintColor={theme.border}
            thumbTintColor={effort.color}
            labelColor={theme.textSecondary}
            tickColor={theme.border}
          />
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.fieldLabel}>{t("logCardio.notes")}</ThemedText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t("logCardio.notesPlaceholder")}
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[styles.notesField, { color: theme.text }]}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            borderTopColor: theme.border,
            backgroundColor: HEVY.canvas,
          },
        ]}
      >
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => void handleSave()}
          disabled={saving}
          testID="button-save-cardio"
        >
          <Feather name="check" size={18} color="#FFFFFF" />
          <ThemedText style={styles.saveBtnText}>
            {saving ? t("logCardio.saving") : t("logCardio.save")}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CARDIO_SOFT,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 26 },
  heroText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  subtitle: { fontSize: 13, opacity: 0.6, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.5,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: {
    backgroundColor: CARDIO_SOFT,
    borderColor: CARDIO_ACCENT,
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 14, fontWeight: "600", color: "#4B5563" },
  chipTextActive: { color: CARDIO_ACCENT_DARK, fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.65,
    marginBottom: 6,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionalTag: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.4,
    marginBottom: 6,
  },
  metricRow: { flexDirection: "row", alignItems: "flex-start" },
  metricCol: { flex: 1 },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: Spacing.md,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  inputNumber: { flex: 1, fontSize: 20, fontWeight: "700" },
  inputText: { flex: 1, fontSize: 16 },
  unit: { fontSize: 13, fontWeight: "600", opacity: 0.5 },
  rpeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  effortBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  effortBadgeText: { fontSize: 13, fontWeight: "700" },
  notesField: {
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
    paddingTop: 2,
  },
  footer: {
    paddingHorizontal: HEVY.pad,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: CARDIO_ACCENT,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    shadowColor: CARDIO_ACCENT,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
