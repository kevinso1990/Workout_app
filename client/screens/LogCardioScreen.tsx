import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { SliderWithTicks } from "@/components/SliderWithTicks";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
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
    <View style={[styles.screen, { backgroundColor: HEVY.canvas }]}>
      <ScrollView
        contentContainerStyle={{
          ...hevyHeaderInsets(insets.top),
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText style={styles.title}>{t("logCardio.title")}</ThemedText>
        <ThemedText style={styles.subtitle}>{t("logCardio.subtitle")}</ThemedText>

        <ThemedText style={styles.label}>{t("logCardio.sport")}</ThemedText>
        <View style={styles.chips}>
          {SPORTS.map((s) => {
            const active = sport === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSport(s)}
                style={[
                  styles.chip,
                  active && { backgroundColor: Colors.light.primary },
                ]}
              >
                <ThemedText
                  style={[styles.chipText, active && { color: "#FFFFFF" }]}
                >
                  {sportLabel(s)}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {sport === "custom" ? (
          <>
            <ThemedText style={styles.label}>{t("logCardio.customName")}</ThemedText>
            <TextInput
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder={t("logCardio.customNamePlaceholder")}
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
          </>
        ) : null}

        <ThemedText style={styles.label}>{t("logCardio.duration")}</ThemedText>
        <TextInput
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
          placeholder="45"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />

        <ThemedText style={styles.label}>{t("logCardio.distance")}</ThemedText>
        <TextInput
          value={distance}
          onChangeText={setDistance}
          keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
          placeholder={t("logCardio.distancePlaceholder")}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />

        <ThemedText style={styles.label}>
          {t("logCardio.rpe")} — {rpe}/10
        </ThemedText>
        <SliderWithTicks
          min={1}
          max={10}
          step={1}
          value={rpe}
          onValueChange={setRpe}
          minimumTrackTintColor={Colors.light.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={Colors.light.primary}
          labelColor={theme.textSecondary}
          tickColor={theme.border}
        />

        <ThemedText style={styles.label}>{t("logCardio.notes")}</ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t("logCardio.notesPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.input,
            styles.notes,
            { color: theme.text, borderColor: theme.border },
          ]}
        />

        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          <Feather name="check" size={18} color="#FFFFFF" />
          <ThemedText style={styles.saveBtnText}>
            {saving ? t("logCardio.saving") : t("logCardio.save")}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, opacity: 0.65, marginBottom: Spacing.lg },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    textTransform: "uppercase",
    opacity: 0.7,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#FFFFFF",
  },
  notes: { minHeight: 88, textAlignVertical: "top" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: 16,
    marginTop: Spacing.xl,
  },
  saveBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
