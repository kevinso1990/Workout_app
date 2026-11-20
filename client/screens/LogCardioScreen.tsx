import React, { useMemo, useState} from "react";
import { Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
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
import { ActivityIcon } from "@/components/schedule/activityIcons";
import { trackWorkoutCompleted } from "@/lib/analytics";

const SPORTS: CardioSportType[] = [
  "running",
  "football",
  "tennis",
  "cycling",
  "swimming",
  "boxing",
  "custom",
];

/**
 * Effort tier → label key + plate colour. Effort is load, so it takes the
 * plate colours (green → yellow → red) like every other intensity mark.
 */
function effortMeta(rpe: number, c: Palette): { key: string; color: string } {
  if (rpe <= 3) return { key: "effortEasy", color: c.plateLight };
  if (rpe <= 6) return { key: "effortModerate", color: c.plateMedium };
  if (rpe <= 8) return { key: "effortHard", color: c.plateHeavy };
  return { key: "effortMax", color: c.plateHeavy };
}

type LogCardioRoute = RouteProp<RootStackParamList, "LogCardio">;

export default function LogCardioScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<LogCardioRoute>();

  // Opened from today's sport appointment, it starts filled in with it.
  const prefill = route.params;
  const prefillSport = prefill?.sport as CardioSportType | undefined;
  const knownSport = !!prefillSport && SPORTS.includes(prefillSport);
  const [sport, setSport] = useState<CardioSportType>(
    knownSport ? prefillSport! : prefillSport ? "custom" : "running",
  );
  const [customLabel, setCustomLabel] = useState(
    prefill?.customLabel ?? (prefillSport && !knownSport ? t(`calendar.sports.${prefillSport}`, { defaultValue: prefillSport }) : ""),
  );
  const [duration, setDuration] = useState(String(prefill?.durationMinutes ?? 45));
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
  const effort = effortMeta(rpe, theme);

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
      trackWorkoutCompleted(session);
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
      style={[styles.screen, { backgroundColor: theme.iron }]}
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
            <ActivityIcon sport={sport} size={24} color={theme.chalk} />
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
                <ActivityIcon sport={s} size={16} color={active ? theme.onChalk : theme.chalkDim} />
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
              <Feather name="edit-3" size={16} color={theme.textSecondary} />
              <TextInput
                returnKeyType="done"
                clearButtonMode="while-editing"
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
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <TextInput
                  selectTextOnFocus
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
                <Feather name="map-pin" size={16} color={theme.textSecondary} />
                <TextInput
                  returnKeyType="done"
                  clearButtonMode="while-editing"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  placeholder="–"
                  placeholderTextColor={theme.chalkFaint}
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
            backgroundColor: theme.iron,
          },
        ]}
      >
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => void handleSave()}
          disabled={saving}
          testID="button-save-cardio"
        >
          <Feather name="check" size={18} color={theme.onChalk} />
          <ThemedText style={styles.saveBtnText}>
            {saving ? t("logCardio.saving") : t("logCardio.save")}
          </ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
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
    backgroundColor: c.ironElevated2,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  subtitle: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: c.textSecondary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: c.backgroundDefault,
    borderWidth: 1,
    borderColor: c.hairline,
  },
  // Selected like every chip in the app: chalk fill, iron text.
  chipActive: {
    backgroundColor: c.chalk,
    borderColor: c.chalk,
  },
  chipText: { fontSize: 14, fontWeight: "600", color: c.chalkDim },
  chipTextActive: { color: c.onChalk, fontWeight: "700" },
  card: {
    backgroundColor: c.backgroundDefault,
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
    color: c.textSecondary,
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
    color: c.chalkFaint,
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
  unit: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
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
    // The primary action is chalk, as everywhere outside "today".
    backgroundColor: c.chalk,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
  },
  saveBtnText: { color: c.onChalk, fontWeight: "700", fontSize: 16 },
});
