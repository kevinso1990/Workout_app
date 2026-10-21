import React, { useCallback, useState, useMemo} from "react";
import { SERIES_BLUE } from "@/constants/chartColors";
import { getMuscleGroupMeta } from "@/lib/exerciseImages";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  Dimensions,
  Modal,
} from "react-native";
import Svg, {
  Polyline as SvgPolyline,
  Circle as SvgCircle,
  Polygon as SvgPolygon,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { hapticLight } from "@/lib/safeHaptics";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import { translateMuscleGroup } from "@/lib/exerciseTaxonomy";
import { translateDayName } from "@/lib/dayNameLabel";
import { WorkoutSession, getWorkoutHistory, ExerciseProgress, isCardioSession, sessionDisplayTitle } from "@/lib/storage";
import { HybridProgressPanel } from "@/components/progress/HybridProgressPanel";
import { localizeExerciseName } from "@/lib/exerciseNameCatalog";
import {
  estimate1RM,
  formatVolume,
  recentRecords,
  thisWeekSummary,
  weekStreak,
  weeklySetsByMuscle,
  weeklyVolumes,
  type PersonalRecord,
} from "@/lib/strengthProgress";
import { NativeRecoveryPanel } from "@/components/progress/NativeRecoveryPanel";
import type { ProgressPeriod } from "@/lib/hybridProgressReport";
import { useTranslation } from "react-i18next";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.lg * 2;

interface ExerciseSessionData {
  date: string;
  maxWeight: number;
  maxWeightReps: number;
  estimated1RM: number;
}

interface ExerciseProgressData {
  exerciseName: string;
  lastUsed: string;
  sessions: ExerciseSessionData[];
  bestSession: ExerciseSessionData;
  totalSessions: number;
}

// Must match the muscle_group values used by the backend exercise seed and the
// local WorkoutPlan exercise data.
//
// The colours come from MUSCLE_GROUP_META rather than being written out again
// here. They were duplicated, and the two copies had drifted: biceps was orange
// on an exercise badge and green in this chart, back was two different blues.
// One muscle, one colour.
const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Legs",
  "Core",
  "Traps",
].map((name) => ({ name, color: getMuscleGroupMeta(name).color }));

function StatCard({
  icon,
  label,
  value,
  index,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  index: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
    >
      {/* Neutral on purpose: colour on this tab is reserved for load. */}
      <View style={[styles.statIcon, { backgroundColor: theme.ironElevated3 }]}>
        <Feather name={icon} size={18} color={theme.text} />
      </View>
      {/* No adjustsFontSizeToFit: on iOS it shrank a lone "0" to a dot. */}
      <ThemedText style={styles.statValue} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </Animated.View>
  );
}

function VolumeChart({
  data,
  index,
}: {
  data: { week: string; volume: number }[];
  index: number;
}) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.chartContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.chartHeader}>
        <View>
          <ThemedText style={styles.chartTitle}>{t("progress.weeklyVolume")}</ThemedText>
          <ThemedText style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
            {t("progress.volumeSubtitle")}
          </ThemedText>
        </View>
      </View>

      <View style={styles.chartBars}>
        {data.map((item, idx) => {
          const heightPercent = (item.volume / maxVolume) * 100;
          return (
            <View key={idx} style={styles.barWrapper}>
              <View style={styles.barContainer}>
                <Animated.View
                  entering={FadeIn.delay(300 + idx * 50).duration(400)}
                  style={[styles.barBackground, { backgroundColor: theme.border }]}
                >
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPercent}%`, backgroundColor: theme.primary },
                    ]}
                  />
                </Animated.View>
              </View>
              <ThemedText style={[styles.barLabel, { color: theme.textSecondary }]}>
                {item.week}
              </ThemedText>
              {/* Always one line, even for empty weeks — otherwise the bars
                  with a value sat higher than the ones without. */}
              <ThemedText
                style={[
                  styles.barValue,
                  { color: item.volume > 0 ? theme.text : theme.textSecondary },
                ]}
              >
                {item.volume > 0 ? formatVolume(item.volume, i18n.language) : "–"}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function MuscleBalance({
  data,
  index,
}: {
  data: { name: string; sets: number; color: string }[];
  index: number;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const totalSets = data.reduce((acc, m) => acc + m.sets, 0);
  const maxSets = Math.max(...data.map((d) => d.sets), 1);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.muscleContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.muscleHeader}>
        <ThemedText style={styles.chartTitle}>{t("progress.muscleBalanceTitle")}</ThemedText>
        <ThemedText style={[styles.musclePeriod, { color: theme.textSecondary }]}>
          {t("progress.thisWeek")}
        </ThemedText>
      </View>

      {totalSets === 0 ? (
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            {t("progress.muscleCoverageEmpty")}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.muscleList}>
          {data.map((muscle, idx) => {
            const widthPercent = (muscle.sets / maxSets) * 100;
            return (
              <View key={idx} style={styles.muscleRow}>
                <View style={styles.muscleNameContainer}>
                  <ThemedText style={[styles.muscleName, { color: theme.text }]}>
                    {translateMuscleGroup(t, muscle.name)}
                  </ThemedText>
                </View>
                <View style={styles.muscleBarWrapper}>
                  <View style={[styles.muscleBarBg, { backgroundColor: theme.border }]}>
                    <Animated.View
                      entering={FadeIn.delay(400 + idx * 30).duration(300)}
                      style={[
                        styles.muscleBarFill,
                        { width: `${widthPercent}%`, backgroundColor: theme.primary },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.muscleSets, { color: theme.textSecondary }]}>
                    {t("progress.setsCount", { count: muscle.sets })}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const calculate1RM = estimate1RM;

function OneRMChart({
  data,
  index,
}: {
  data: { exercise: string; history: { date: string; estimated1RM: number }[]; color: string }[];
  index: number;
}) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [selectedLift, setSelectedLift] = useState(0);
  const selectedData = data[selectedLift];
  const max1RM = selectedData?.history.length > 0 
    ? Math.max(...selectedData.history.map(h => h.estimated1RM)) 
    : 100;
  const min1RM = selectedData?.history.length > 0 
    ? Math.min(...selectedData.history.map(h => h.estimated1RM)) 
    : 0;
  const range = max1RM - min1RM || 1;

  if (data.every(d => d.history.length === 0)) {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100).duration(400)}
        style={[styles.oneRMContainer, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.chartHeader}>
          <View>
            <ThemedText style={styles.chartTitle}>{t("progress.est1RM")}</ThemedText>
            <ThemedText style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
              {t("progress.fullHistory", { defaultValue: "Gesamter Verlauf" })}
            </ThemedText>
          </View>
        </View>
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            {t("progress.logCompoundLifts")}
          </ThemedText>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.oneRMContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.chartHeader}>
        <View>
          <ThemedText style={styles.chartTitle}>{t("progress.est1RM")}</ThemedText>
          {/* This chart ignores the Woche/Monat/Jahr toggle above — it always
              plots the full session history for the selected lift. Worth
              saying explicitly: that toggle looks like it should scope
              everything on the screen, but only the summary cards above it
              actually respect it. */}
          <ThemedText style={[styles.chartSubtitle, { color: theme.textSecondary }]}>
            {t("progress.fullHistory", { defaultValue: "Gesamter Verlauf" })}
          </ThemedText>
        </View>
        {selectedData?.history.length > 0 ? (
          <View style={[styles.oneRMBadge, { backgroundColor: selectedData.color + "15" }]}>
            <ThemedText style={[styles.oneRMBadgeText, { color: selectedData.color }]}>
              {selectedData.history[selectedData.history.length - 1]?.estimated1RM} kg
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.liftSelector}
        contentContainerStyle={styles.liftSelectorContent}
      >
        {data.map((lift, idx) => (
          <Pressable
            key={lift.exercise}
            onPress={() => setSelectedLift(idx)}
            style={[
              styles.liftChip,
              idx === selectedLift
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: "transparent", borderColor: theme.controlOutline },
            ]}
          >
            <ThemedText
              style={[
                styles.liftChipText,
                { color: idx === selectedLift ? theme.onChalk : theme.text },
              ]}
            >
              {localizeExerciseName(lift.exercise, i18n.language)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {selectedData?.history.length === 1 ? (
        // One session is a value, not a trend — a "chart" of one dot on an
        // axis reading 19 / 19 / 19 looked broken.
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            {t("progress.oneRMNeedsTwo")}
          </ThemedText>
        </View>
      ) : selectedData?.history.length > 0 ? (
        <View style={styles.oneRMGraph}>
          <View style={styles.oneRMYAxis}>
            <ThemedText style={[styles.oneRMAxisLabel, { color: theme.textSecondary }]}>
              {max1RM}
            </ThemedText>
            <ThemedText style={[styles.oneRMAxisLabel, { color: theme.textSecondary }]}>
              {Math.round((max1RM + min1RM) / 2)}
            </ThemedText>
            <ThemedText style={[styles.oneRMAxisLabel, { color: theme.textSecondary }]}>
              {min1RM}
            </ThemedText>
          </View>
          <View style={styles.oneRMChartArea}>
            <View style={[styles.oneRMGridLine, { backgroundColor: theme.border }]} />
            <View style={[styles.oneRMGridLine, { backgroundColor: theme.border, top: "50%" }]} />
            <View style={[styles.oneRMGridLine, { backgroundColor: theme.border, top: "100%" }]} />
            <View style={styles.oneRMLine}>
              {selectedData.history.slice(-8).map((point, idx, arr) => {
                const heightPercent = ((point.estimated1RM - min1RM) / range) * 100;
                return (
                  <View key={idx} style={styles.oneRMPointWrapper}>
                    <Animated.View
                      entering={FadeIn.delay(500 + idx * 50).duration(300)}
                      style={[
                        styles.oneRMPoint,
                        {
                          backgroundColor: selectedData.color,
                          bottom: `${heightPercent}%`,
                        },
                      ]}
                    />
                    {idx > 0 ? (
                      <View
                        style={[
                          styles.oneRMConnector,
                          { backgroundColor: selectedData.color + "40" },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            {t("progress.noDataFor", {
              exercise: localizeExerciseName(selectedData?.exercise ?? "", i18n.language),
            })}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

/**
 * The reason people open a progress tab: "did I get stronger?". Hevy leads
 * with PRs; we buried strength under the hybrid report.
 */
function RecordsCard({ records, index }: { records: PersonalRecord[]; index: number }) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.chartContainer, { backgroundColor: theme.backgroundDefault }]}
      testID="card-records"
    >
      <View style={styles.chartHeader}>
        <ThemedText style={styles.chartTitle}>{t("progress.recordsTitle")}</ThemedText>
        <ThemedText style={[styles.musclePeriod, { color: theme.textSecondary }]}>
          {t("progress.last30Days")}
        </ThemedText>
      </View>
      {records.length === 0 ? (
        <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
          {t("progress.recordsEmpty")}
        </ThemedText>
      ) : (
        records.map((r, i) => (
          <View
            key={r.exerciseName}
            style={[
              styles.recordRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline },
            ]}
          >
            <View style={[styles.recordIcon, { backgroundColor: theme.ironElevated3 }]}>
              <Feather name="award" size={16} color={theme.text} />
            </View>
            <View style={styles.recordText}>
              <ThemedText style={styles.recordName} numberOfLines={1}>
                {localizeExerciseName(r.exerciseName, i18n.language)}
              </ThemedText>
              <ThemedText style={[styles.recordMeta, { color: theme.textSecondary }]}>
                {t("progress.recordLine", { weight: r.weight, reps: r.reps, e1rm: r.estimated1RM })}
              </ThemedText>
            </View>
            <ThemedText style={[styles.recordGain, { color: theme.text }]}>
              {t("progress.recordGain", { kg: r.estimated1RM - r.previous1RM })}
            </ThemedText>
          </View>
        ))
      )}
    </Animated.View>
  );
}

function WorkoutHistoryItem({
  session,
  index,
}: {
  session: WorkoutSession;
  index: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const scale = useSharedValue(1);
  const cardio = isCardioSession(session);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return t("startWorkout.lastPerformedToday");
    if (diffDays === 1) return t("startWorkout.lastPerformedYesterday");
    if (diffDays < 7) return t("startWorkout.lastPerformedDaysAgo", { count: diffDays });
    return date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  };

  const calculateVolume = () => {
    if (!session.exerciseProgress) return 0;
    return session.exerciseProgress.reduce((total, ep) => {
      return (
        total +
        ep.sets
          .filter((s) => s.completed)
          .reduce((setTotal, s) => {
            const weight = parseFloat(s.weight) || 0;
            const reps = parseInt(s.reps) || 0;
            return setTotal + weight * reps;
          }, 0)
      );
    }, 0);
  };

  const volume = calculateVolume();
  const duration = cardio
    ? session.cardio?.durationMinutes
      ? `${session.cardio.durationMinutes} min`
      : null
    : session.duration
      ? `${Math.floor(session.duration / 60)} min`
      : null;

  return (
    <Animated.View entering={FadeInDown.delay(200 + index * 80).duration(400)}>
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        }}
        style={[
          animatedStyle,
          styles.historyItem,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View
          style={[
            styles.historyIcon,
            {
              backgroundColor: cardio
                ? "#FEF3C7"
                : theme.success + "20",
            },
          ]}
        >
          <Feather
            name={cardio ? "zap" : "check-circle"}
            size={20}
            color={cardio ? "#D97706" : theme.success}
          />
        </View>
        <View style={styles.historyInfo}>
          <ThemedText style={styles.historyTitle}>
            {cardio ? sessionDisplayTitle(session) : translateDayName(t, session.dayName)}
          </ThemedText>
          <View style={styles.historyMeta}>
            {cardio ? (
              <ThemedText style={[styles.historyMetaText, { color: theme.textSecondary }]}>
                {t("calendar.cardioMeta", {
                  minutes: session.cardio?.durationMinutes ?? 0,
                  rpe: session.cardio?.rpe ?? "—",
                })}
              </ThemedText>
            ) : volume > 0 ? (
              <View style={styles.historyMetaItem}>
                <Feather name="trending-up" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.historyMetaText, { color: theme.textSecondary }]}>
                  {(volume / 1000).toFixed(1)}k kg
                </ThemedText>
              </View>
            ) : null}
            {duration ? (
              <View style={styles.historyMetaItem}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.historyMetaText, { color: theme.textSecondary }]}>
                  {duration}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>
        <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
          {formatDate(session.completedAt)}
        </ThemedText>
      </AnimatedPressable>
    </Animated.View>
  );
}

function SvgLineChart({
  data,
  color,
  chartId,
}: {
  data: number[];
  color: string;
  chartId: string;
}) {
  if (data.length < 2) return null;

  const width = CHART_WIDTH;
  const height = 90;
  const pad = 6;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const gradId = `g_${chartId}`;

  const pts = data.map((val, i) => ({
    x: pad + (i / (data.length - 1)) * plotW,
    y: pad + plotH - ((val - min) / range) * plotH,
  }));

  const lineStr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaStr = `${pad},${height - pad} ${lineStr} ${(width - pad).toFixed(2)},${height - pad}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <SvgPolygon points={areaStr} fill={`url(#${gradId})`} />
      <SvgPolyline
        points={lineStr}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <SvgCircle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} />
      ))}
    </Svg>
  );
}

function ExerciseProgressRow({
  exercise,
  isLast,
  onPress,
}: {
  exercise: ExerciseProgressData;
  isLast: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t("exerciseChart.today");
    if (diffDays === 1) return t("exerciseChart.yesterday");
    if (diffDays < 7) return t("exerciseChart.daysAgoShort", { count: diffDays });
    return date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.exerciseRow,
        !isLast && [styles.exerciseRowBorder, { borderBottomColor: theme.border }],
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.exerciseRowLeft}>
        <ThemedText style={styles.exerciseRowName} numberOfLines={1}>
          {localizeExerciseName(exercise.exerciseName, i18n.language)}
        </ThemedText>
        <ThemedText style={[styles.exerciseRowMeta, { color: theme.textSecondary }]}>
          {t("exerciseChart.sessionCount", { count: exercise.totalSessions })} · {formatLastUsed(exercise.lastUsed)}
        </ThemedText>
      </View>
      <View style={styles.exerciseRowRight}>
        <ThemedText style={[styles.exerciseRowWeight, { color: theme.primary }]}>
          {exercise.bestSession.maxWeight} kg
        </ThemedText>
        <ThemedText style={[styles.exerciseRowWeightLabel, { color: theme.textSecondary }]}>
          {t("exerciseChart.best")}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ marginLeft: Spacing.xs }} />
    </Pressable>
  );
}

function ExerciseDetailModal({
  visible,
  exercise,
  onClose,
}: {
  visible: boolean;
  exercise: ExerciseProgressData | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();

  if (!exercise) return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const weightData = exercise.sessions.map((s) => s.maxWeight);
  const ormData = exercise.sessions.map((s) => s.estimated1RM);
  const hasChartData = exercise.sessions.length >= 2;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        {/* Drag-to-dismiss handle */}
        <View style={styles.modalDragHandleArea}>
          <View style={styles.modalDragBar} />
        </View>

        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <ThemedText style={styles.modalTitle} numberOfLines={1}>
            {localizeExerciseName(exercise.exerciseName, i18n.language)}
          </ThemedText>
          <Pressable onPress={onClose} style={styles.modalClose} hitSlop={6}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary stat chips */}
          <View style={styles.modalStatsRow}>
            <View style={[styles.modalStatCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.modalStatValue, { color: theme.primary }]}>
                {exercise.totalSessions}
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                {t("exerciseChart.sessions")}
              </ThemedText>
            </View>
            <View style={[styles.modalStatCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.modalStatValue, { color: "#10B981" }]}>
                {exercise.bestSession.maxWeight} kg
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                {t("exerciseChart.bestWeight")}
              </ThemedText>
            </View>
            <View style={[styles.modalStatCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.modalStatValue, { color: SERIES_BLUE }]}>
                {exercise.bestSession.estimated1RM} kg
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                {t("exerciseChart.est1RM")}
              </ThemedText>
            </View>
          </View>

          {hasChartData ? (
            <>
              {/* Max Weight chart */}
              <View style={[styles.modalChartCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.modalChartHeader}>
                  <ThemedText style={styles.modalChartTitle}>{t("exerciseChart.maxWeight")}</ThemedText>
                  <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>kg</ThemedText>
                </View>
                <SvgLineChart data={weightData} color={theme.primary} chartId="weight" />
                <View style={styles.modalChartFooter}>
                  <ThemedText style={[styles.modalChartDateLabel, { color: theme.textSecondary }]}>
                    {formatDate(exercise.sessions[0].date)}
                  </ThemedText>
                  <ThemedText style={[styles.modalChartDateLabel, { color: theme.textSecondary }]}>
                    {formatDate(exercise.sessions[exercise.sessions.length - 1].date)}
                  </ThemedText>
                </View>
              </View>

              {/* Est. 1RM chart */}
              <View style={[styles.modalChartCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.modalChartHeader}>
                  <ThemedText style={styles.modalChartTitle}>{t("exerciseChart.estimated1RM")}</ThemedText>
                  <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>kg</ThemedText>
                </View>
                <SvgLineChart data={ormData} color={SERIES_BLUE} chartId="orm" />
                <View style={styles.modalChartFooter}>
                  <ThemedText style={[styles.modalChartDateLabel, { color: theme.textSecondary }]}>
                    {formatDate(exercise.sessions[0].date)}
                  </ThemedText>
                  <ThemedText style={[styles.modalChartDateLabel, { color: theme.textSecondary }]}>
                    {formatDate(exercise.sessions[exercise.sessions.length - 1].date)}
                  </ThemedText>
                </View>
              </View>
            </>
          ) : (
            /* 1 session: show stats card + prompt to log again */
            <View style={[styles.modalChartCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.modalChartHeader}>
                <ThemedText style={styles.modalChartTitle}>{t("exerciseChart.firstSession")}</ThemedText>
                <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>
                  {formatDate(exercise.sessions[0].date)}
                </ThemedText>
              </View>
              <View style={styles.singleSessionStatsRow}>
                <View style={styles.singleSessionStat}>
                  <View style={styles.singleSessionValueRow}>
                    <ThemedText style={[styles.singleSessionValue, { color: theme.primary }]}>
                      {exercise.sessions[0].maxWeight} kg
                    </ThemedText>
                    <View style={styles.pbBadge}>
                      <ThemedText style={styles.pbBadgeText}>{t("exerciseChart.pb")}</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    {t("exerciseChart.weight")}
                  </ThemedText>
                </View>
                <View style={[styles.singleSessionDivider, { backgroundColor: theme.border }]} />
                <View style={styles.singleSessionStat}>
                  <ThemedText style={[styles.singleSessionValue, { color: theme.text }]}>
                    {exercise.sessions[0].maxWeightReps}
                  </ThemedText>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    {t("exerciseChart.reps")}
                  </ThemedText>
                </View>
                <View style={[styles.singleSessionDivider, { backgroundColor: theme.border }]} />
                <View style={styles.singleSessionStat}>
                  <ThemedText style={[styles.singleSessionValue, { color: SERIES_BLUE }]}>
                    {exercise.sessions[0].estimated1RM} kg
                  </ThemedText>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    {t("exerciseChart.est1RM")}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.logAgainRow}>
                <Feather name="trending-up" size={13} color={theme.textSecondary} />
                <ThemedText style={[styles.logAgainText, { color: theme.textSecondary }]}>
                  {t("exerciseChart.logAgainPrompt")}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Best session card with Personal Best badge */}
          <View style={[styles.modalBestSession, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.bestSessionIcon, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="award" size={20} color={theme.primary} />
            </View>
            <View style={styles.bestSessionInfo}>
              <ThemedText style={styles.modalChartTitle}>{t("exerciseChart.bestSession")}</ThemedText>
              <ThemedText style={[styles.bestSessionDate, { color: theme.textSecondary }]}>
                {formatDate(exercise.bestSession.date)}
              </ThemedText>
              <View style={styles.bestSessionWeightRow}>
                <ThemedText style={[styles.bestSessionStats, { color: theme.text }]}>
                  {exercise.bestSession.maxWeight} kg × {exercise.bestSession.maxWeightReps}
                </ThemedText>
                <View style={styles.pbBadge}>
                  <ThemedText style={styles.pbBadgeText}>{t("exerciseChart.personalBest")}</ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.bestSessionStats, { color: theme.textSecondary }]}>
                {t("exerciseChart.est1RMValue", { value: exercise.bestSession.estimated1RM })}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ExerciseProgressSection({
  data,
  index,
}: {
  data: ExerciseProgressData[];
  index: number;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [selectedExercise, setSelectedExercise] = useState<ExerciseProgressData | null>(null);

  if (data.length === 0) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(index * 100).duration(400)}
        style={styles.sectionHeader}
      >
        <ThemedText style={styles.sectionTitle}>{t("progress.exerciseProgress")}</ThemedText>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.delay(index * 100 + 50).duration(400)}
        style={[styles.exerciseProgressList, { backgroundColor: theme.backgroundDefault }]}
      >
        {data.map((exercise, idx) => (
          <ExerciseProgressRow
            key={exercise.exerciseName}
            exercise={exercise}
            isLast={idx === data.length - 1}
            onPress={() => setSelectedExercise(exercise)}
          />
        ))}
      </Animated.View>

      <ExerciseDetailModal
        visible={selectedExercise !== null}
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
      />
    </>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-progress.png")}
        style={styles.emptyIllustration}
        resizeMode="contain"
      />
      <ThemedText style={styles.emptyTitle}>{t("progress.noWorkoutsYet")}</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {t("progress.noWorkoutsDesc")}
      </ThemedText>

      {/* An empty state that only describes the gap is a dead end — give the
          user the action it's asking for. */}
      <Pressable
        onPress={() => {
          hapticLight();
          navigation.navigate("StartWorkout", {});
        }}
        style={({ pressed }) => [
          styles.emptyCta,
          { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        testID="button-progress-empty-start"
      >
        <Feather name="play" size={18} color={theme.onChalk} />
        <ThemedText style={styles.emptyCtaText}>
          {t("progress.startFirstWorkout")}
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [hybridPeriod, setHybridPeriod] = useState<ProgressPeriod>("month");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const loadedHistory = await getWorkoutHistory();
      setHistory(loadedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadHistory();
  };

  const { i18n } = useTranslation();
  // Re-read the clock whenever history reloads (focus / pull-to-refresh).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [history]);
  const week = useMemo(() => thisWeekSummary(history, now), [history, now]);
  const streak = useMemo(() => weekStreak(history, now), [history, now]);
  const records = useMemo(() => recentRecords(history, now), [history, now]);

  const weeklyVolumeData = useMemo(
    () =>
      weeklyVolumes(history, now).map(({ weekStart, volume }) => ({
        // Every bar labelled the same way — the week's Monday — instead of
        // a mix of "3w", "2w", "Letzte", "Diese".
        week: weekStart.toLocaleDateString(i18n.language, { day: "numeric", month: "numeric" }),
        volume,
      })),
    [history, now, i18n.language],
  );

  const muscleBalanceData = useMemo(() => {
    const sets = weeklySetsByMuscle(history, now);
    return MUSCLE_GROUPS.map((mg) => ({
      name: mg.name,
      sets: sets[mg.name] || 0,
      color: mg.color,
    })).sort((a, b) => b.sets - a.sets);
  }, [history, now]);

  const getExerciseProgressData = useMemo((): ExerciseProgressData[] => {
    const exerciseMap = new Map<string, ExerciseProgressData>();

    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
    );

    sortedHistory.forEach((session) => {
      session.exercises.forEach((exercise, idx) => {
        const progress = session.exerciseProgress?.[idx];
        if (!progress) return;

        const completedSets = progress.sets.filter((s) => s.completed);
        if (completedSets.length === 0) return;

        let bestEst1RM = 0;
        let bestWeight = 0;
        let bestReps = 0;

        completedSets.forEach((set) => {
          const w = parseFloat(set.weight) || 0;
          const r = parseInt(set.reps) || 0;
          if (w <= 0 || r <= 0) return;
          const est = calculate1RM(w, r);
          if (est > bestEst1RM) {
            bestEst1RM = est;
            bestWeight = w;
            bestReps = r;
          }
        });

        if (bestWeight === 0) return;

        const name = exercise.name;
        const sessionData: ExerciseSessionData = {
          date: session.completedAt,
          maxWeight: bestWeight,
          maxWeightReps: bestReps,
          estimated1RM: bestEst1RM,
        };

        if (!exerciseMap.has(name)) {
          exerciseMap.set(name, {
            exerciseName: name,
            lastUsed: session.completedAt,
            sessions: [sessionData],
            bestSession: sessionData,
            totalSessions: 1,
          });
        } else {
          const entry = exerciseMap.get(name)!;
          entry.sessions.push(sessionData);
          entry.totalSessions++;
          if (new Date(session.completedAt) > new Date(entry.lastUsed)) {
            entry.lastUsed = session.completedAt;
          }
          if (bestEst1RM > entry.bestSession.estimated1RM) {
            entry.bestSession = sessionData;
          }
        }
      });
    });

    return Array.from(exerciseMap.values()).sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
  }, [history]);

  // The lifts this athlete actually logs most, instead of six hard-coded
  // barbell names that most plans never contain.
  const oneRMData = useMemo(
    () =>
      [...getExerciseProgressData]
        .sort((a, b) => b.totalSessions - a.totalSessions)
        .slice(0, 6)
        .map((e) => ({
          exercise: e.exerciseName,
          history: e.sessions.map((x) => ({ date: x.date, estimated1RM: x.estimated1RM })),
          color: theme.primary,
        })),
    [getExerciseProgressData, theme.primary],
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl),
          paddingBottom: tabBarHeight + Spacing.xl,
        },
        history.length === 0 && styles.emptyContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
        />
      }
    >
      {history.length === 0 ? (
        <>
          <EmptyState />
          <NativeRecoveryPanel index={1} />
        </>
      ) : (
        <>
          <View style={styles.sectionHeaderFirst}>
            <ThemedText style={styles.sectionTitle}>{t("progress.weeklySummaryTitle")}</ThemedText>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon="calendar"
              label={t("progress.weekWorkouts")}
              value={week.workouts.toString()}
              index={0}
            />
            <StatCard
              icon="layers"
              label={t("progress.weekSets")}
              value={week.sets.toString()}
              index={1}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon="bar-chart-2"
              label={t("progress.weekVolume")}
              value={formatVolume(week.volume, i18n.language)}
              index={2}
            />
            <StatCard
              icon="zap"
              label={t("progress.weekStreak", { count: streak })}
              value={streak.toString()}
              index={3}
            />
          </View>

          <RecordsCard records={records} index={4} />

          <VolumeChart data={weeklyVolumeData} index={5} />

          <OneRMChart data={oneRMData} index={6} />

          <MuscleBalance data={muscleBalanceData} index={7} />

          <ExerciseProgressSection data={getExerciseProgressData} index={8} />

          {/* Cardio and recovery are context for the lifting, not the
              headline — they sit below it. */}
          <View style={styles.hybridSection}>
            <HybridProgressPanel
              history={history}
              period={hybridPeriod}
              onPeriodChange={setHybridPeriod}
            />
          </View>

          <NativeRecoveryPanel index={9} />

          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            style={styles.sectionHeader}
          >
            <ThemedText style={styles.sectionTitle}>{t("history.title")}</ThemedText>
          </Animated.View>

          <View style={styles.historyList}>
            {history.slice(0, 10).map((session, index) => (
              <WorkoutHistoryItem
                key={session.id}
                session={session}
                index={index}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.lg + 4,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.hairlineStrong,
    minHeight: 0,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
    marginBottom: Spacing.xs,
    paddingTop: 4,
    width: "100%",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 13,
    textAlign: "center",
  },
  statSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  chartContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
  },
  chartSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chartLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 120,
    paddingTop: 20,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
  },
  barContainer: {
    flex: 1,
    width: 32,
    justifyContent: "flex-end",
  },
  barBackground: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: BorderRadius.sm,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 6,
  },
  barValue: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  muscleContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  muscleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  musclePeriod: {
    fontSize: 12,
  },
  muscleEmpty: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  muscleEmptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  muscleList: {
    gap: Spacing.md,
  },
  muscleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  muscleNameContainer: {
    width: 80,
  },
  muscleName: {
    fontSize: 13,
    fontWeight: "500",
  },
  muscleBarWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  muscleBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  muscleBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  muscleSets: {
    fontSize: 11,
    width: 50,
    textAlign: "right",
  },
  sectionHeader: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeaderFirst: {
    marginBottom: Spacing.md,
  },
  hybridSection: {
    marginTop: Spacing.xl,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  recordIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  recordText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  recordName: {
    fontSize: 15,
    fontWeight: "600",
  },
  recordMeta: {
    fontSize: 13,
  },
  recordGain: {
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
  },
  historyList: {
    gap: Spacing.md,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
    marginBottom: Spacing.xs,
  },
  historyMeta: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  historyMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyMetaText: {
    fontSize: 12,
  },
  historyDate: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIllustration: {
    width: 200,
    height: 200,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  emptyCtaText: {
    color: c.onChalk,
    fontSize: 16,
    fontWeight: "700",
  },
  oneRMContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  oneRMBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  oneRMBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
  },
  liftSelector: {
    marginBottom: Spacing.md,
  },
  liftSelectorContent: {
    gap: Spacing.sm,
  },
  liftChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  liftChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  oneRMGraph: {
    flexDirection: "row",
    height: 120,
  },
  oneRMYAxis: {
    width: 35,
    justifyContent: "space-between",
    paddingRight: Spacing.xs,
  },
  oneRMAxisLabel: {
    fontSize: 10,
    textAlign: "right",
  },
  oneRMChartArea: {
    flex: 1,
    position: "relative",
  },
  oneRMGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    top: 0,
  },
  oneRMLine: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    position: "relative",
  },
  oneRMPointWrapper: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
  },
  oneRMPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: "absolute",
  },
  oneRMConnector: {
    position: "absolute",
    width: 2,
    height: 20,
  },
  heatmapContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  heatmapBody: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  heatmapFigure: {
    width: 80,
    height: 160,
    alignItems: "center",
  },
  heatmapHead: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  heatmapNeck: {
    width: 8,
    height: 6,
    marginBottom: 2,
  },
  heatmapTorso: {
    width: 40,
    height: 50,
    alignItems: "center",
  },
  heatmapShoulders: {
    width: 50,
    height: 10,
    borderRadius: 5,
    marginBottom: 2,
  },
  heatmapChest: {
    width: 36,
    height: 20,
    borderRadius: 4,
    marginBottom: 2,
  },
  heatmapCore: {
    width: 28,
    height: 18,
    borderRadius: 4,
  },
  heatmapArms: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  heatmapArm: {
    width: 10,
    height: 35,
    borderRadius: 5,
  },
  heatmapLegs: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  heatmapLeg: {
    width: 14,
    height: 50,
    borderRadius: 7,
  },
  heatmapLegend: {
    flex: 1,
    gap: Spacing.sm,
  },
  heatmapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  heatmapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  heatmapLegendText: {
    flex: 1,
    fontSize: 13,
  },
  heatmapLegendValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Exercise Progress List
  exerciseProgressList: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
    overflow: "hidden",
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  exerciseRowBorder: {
    borderBottomWidth: 1,
  },
  exerciseRowLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  exerciseRowName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
    marginBottom: 2,
  },
  exerciseRowMeta: {
    fontSize: 12,
  },
  exerciseRowRight: {
    alignItems: "flex-end",
  },
  exerciseRowWeight: {
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
  },
  exerciseRowWeightLabel: {
    fontSize: 11,
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalDragHandleArea: {
    alignItems: "center",
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  modalDragBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: c.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
  },
  modalClose: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  modalContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["4xl"],
  },
  modalStatsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  modalStatCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
    marginBottom: 2,
  },
  modalStatLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  modalChartCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  modalChartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  modalChartTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
  },
  modalChartUnit: {
    fontSize: 12,
  },
  modalChartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  modalChartDateLabel: {
    fontSize: 11,
  },
  modalBestSession: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: c.hairlineStrong,
  },
  bestSessionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  bestSessionInfo: {
    flex: 1,
  },
  bestSessionDate: {
    fontSize: 12,
    marginBottom: Spacing.xs,
    marginTop: 2,
  },
  bestSessionStats: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  bestSessionWeightRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: 2,
  },
  pbBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: c.primary + "20",
  },
  pbBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Archivo_600SemiBold",
    color: c.primary,
  },
  singleSessionStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  singleSessionStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  singleSessionValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  singleSessionValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Archivo_700Bold",
  },
  singleSessionLabel: {
    fontSize: 11,
  },
  singleSessionDivider: {
    width: 1,
    height: 32,
  },
  logAgainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: c.hairlineStrong,
  },
  logAgainText: {
    fontSize: 12,
  },
});
