import React, { useCallback, useState, useMemo } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { WorkoutSession, getWorkoutHistory, ExerciseProgress, COMPOUND_LIFTS } from "@/lib/storage";

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

// Must match the muscle_group values used by the backend exercise seed
// and the local WorkoutPlan exercise data.
const MUSCLE_GROUPS = [
  { name: "Chest", color: "#FF4D00" },
  { name: "Back", color: "#3B82F6" },
  { name: "Shoulders", color: "#8B5CF6" },
  { name: "Biceps", color: "#10B981" },
  { name: "Triceps", color: "#F59E0B" },
  { name: "Legs", color: "#EC4899" },
  { name: "Core", color: "#6366F1" },
  { name: "Traps", color: "#14B8A6" },
];

function StatCard({
  icon,
  label,
  value,
  subtitle,
  color,
  index,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      {subtitle ? (
        <ThemedText style={[styles.statSubtitle, { color: color }]}>
          {subtitle}
        </ThemedText>
      ) : null}
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
  const { theme } = useTheme();
  const maxVolume = Math.max(...data.map((d) => d.volume), 1);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.chartContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.chartHeader}>
        <ThemedText style={styles.chartTitle}>Weekly Volume</ThemedText>
        <View style={styles.chartLegend}>
          <View style={[styles.legendDot, { backgroundColor: Colors.light.primary }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
            Total kg lifted
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
                  <LinearGradient
                    colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
                    style={[styles.barFill, { height: `${heightPercent}%` }]}
                  />
                </Animated.View>
              </View>
              <ThemedText style={[styles.barLabel, { color: theme.textSecondary }]}>
                {item.week}
              </ThemedText>
              {item.volume > 0 ? (
                <ThemedText style={[styles.barValue, { color: theme.text }]}>
                  {(item.volume / 1000).toFixed(1)}k
                </ThemedText>
              ) : null}
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
  const { theme } = useTheme();
  const totalSets = data.reduce((acc, m) => acc + m.sets, 0);
  const maxSets = Math.max(...data.map((d) => d.sets), 1);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.muscleContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.muscleHeader}>
        <ThemedText style={styles.chartTitle}>Muscle Balance</ThemedText>
        <ThemedText style={[styles.musclePeriod, { color: theme.textSecondary }]}>
          Last 30 days
        </ThemedText>
      </View>

      {totalSets === 0 ? (
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            Complete workouts to see muscle coverage
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
                    {muscle.name}
                  </ThemedText>
                </View>
                <View style={styles.muscleBarWrapper}>
                  <View style={[styles.muscleBarBg, { backgroundColor: theme.border }]}>
                    <Animated.View
                      entering={FadeIn.delay(400 + idx * 30).duration(300)}
                      style={[
                        styles.muscleBarFill,
                        { width: `${widthPercent}%`, backgroundColor: muscle.color },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.muscleSets, { color: theme.textSecondary }]}>
                    {muscle.sets} sets
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

function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

function OneRMChart({
  data,
  index,
}: {
  data: { exercise: string; history: { date: string; estimated1RM: number }[]; color: string }[];
  index: number;
}) {
  const { theme } = useTheme();
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
          <ThemedText style={styles.chartTitle}>Estimated 1RM</ThemedText>
        </View>
        <View style={styles.muscleEmpty}>
          <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
            Log compound lifts to track your strength
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
        <ThemedText style={styles.chartTitle}>Estimated 1RM</ThemedText>
        {selectedData?.history.length > 0 ? (
          <View style={[styles.oneRMBadge, { backgroundColor: selectedData.color + "15" }]}>
            <ThemedText style={[styles.oneRMBadgeText, { color: selectedData.color }]}>
              {selectedData.history[selectedData.history.length - 1]?.estimated1RM}kg
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
              {
                backgroundColor: idx === selectedLift ? lift.color : theme.backgroundSecondary,
                borderColor: lift.color,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.liftChipText,
                { color: idx === selectedLift ? "#FFFFFF" : lift.color },
              ]}
            >
              {lift.exercise}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {selectedData?.history.length > 0 ? (
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
            No data for {selectedData?.exercise}
          </ThemedText>
        </View>
      )}
    </Animated.View>
  );
}

const MUSCLE_HEATMAP_DATA = [
  { id: "chest", label: "Chest", top: 22, left: 35, width: 30 },
  { id: "back", label: "Back", top: 22, left: 35, width: 30 },
  { id: "shoulders", label: "Shoulders", top: 16, left: 25, width: 50 },
  { id: "biceps", label: "Biceps", top: 28, left: 18, width: 15 },
  { id: "triceps", label: "Triceps", top: 28, left: 67, width: 15 },
  { id: "quads", label: "Quads", top: 52, left: 30, width: 18 },
  { id: "hamstrings", label: "Hamstrings", top: 58, left: 30, width: 18 },
  { id: "calves", label: "Calves", top: 72, left: 32, width: 14 },
];

function MuscleHeatmap({
  data,
  index,
}: {
  data: { name: string; sets: number; intensity: number }[];
  index: number;
}) {
  const { theme } = useTheme();
  const maxSets = Math.max(...data.map(d => d.sets), 1);

  const getIntensityColor = (sets: number) => {
    const intensity = sets / maxSets;
    if (intensity === 0) return theme.border;
    if (intensity < 0.33) return Colors.light.primary + "40";
    if (intensity < 0.66) return Colors.light.primary + "80";
    return Colors.light.primary;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).duration(400)}
      style={[styles.heatmapContainer, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={styles.chartHeader}>
        <ThemedText style={styles.chartTitle}>Training Heatmap</ThemedText>
        <ThemedText style={[styles.musclePeriod, { color: theme.textSecondary }]}>
          This week
        </ThemedText>
      </View>

      <View style={styles.heatmapBody}>
        <View style={styles.heatmapFigure}>
          <View style={[styles.heatmapHead, { backgroundColor: theme.border }]} />
          <View style={[styles.heatmapNeck, { backgroundColor: theme.border }]} />
          <View style={styles.heatmapTorso}>
            <View 
              style={[
                styles.heatmapShoulders, 
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Shoulders")?.sets || 0) }
              ]} 
            />
            <View 
              style={[
                styles.heatmapChest, 
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Chest")?.sets || 0) }
              ]} 
            />
            <View 
              style={[
                styles.heatmapCore, 
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Core")?.sets || 0) }
              ]} 
            />
          </View>
          <View style={styles.heatmapArms}>
            <View 
              style={[
                styles.heatmapArm, 
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Biceps")?.sets || 0) }
              ]} 
            />
            <View 
              style={[
                styles.heatmapArm, 
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Triceps")?.sets || 0) }
              ]} 
            />
          </View>
          <View style={styles.heatmapLegs}>
            <View
              style={[
                styles.heatmapLeg,
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Legs")?.sets || 0) }
              ]}
            />
            <View
              style={[
                styles.heatmapLeg,
                { backgroundColor: getIntensityColor(data.find(d => d.name === "Legs")?.sets || 0) }
              ]}
            />
          </View>
        </View>
        <View style={styles.heatmapLegend}>
          {data.filter(d => d.sets > 0).slice(0, 5).map((muscle, idx) => (
            <View key={muscle.name} style={styles.heatmapLegendItem}>
              <View 
                style={[
                  styles.heatmapLegendDot, 
                  { backgroundColor: getIntensityColor(muscle.sets) }
                ]} 
              />
              <ThemedText style={[styles.heatmapLegendText, { color: theme.text }]}>
                {muscle.name}
              </ThemedText>
              <ThemedText style={[styles.heatmapLegendValue, { color: theme.textSecondary }]}>
                {muscle.sets}
              </ThemedText>
            </View>
          ))}
          {data.every(d => d.sets === 0) ? (
            <ThemedText style={[styles.muscleEmptyText, { color: theme.textSecondary }]}>
              Train to see your heatmap
            </ThemedText>
          ) : null}
        </View>
      </View>
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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const duration = session.duration
    ? `${Math.floor(session.duration / 60)}min`
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
            { backgroundColor: Colors.light.success + "20" },
          ]}
        >
          <Feather name="check-circle" size={20} color={Colors.light.success} />
        </View>
        <View style={styles.historyInfo}>
          <ThemedText style={styles.historyTitle}>{session.dayName}</ThemedText>
          <View style={styles.historyMeta}>
            {volume > 0 ? (
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

  const formatLastUsed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
          {exercise.exerciseName}
        </ThemedText>
        <ThemedText style={[styles.exerciseRowMeta, { color: theme.textSecondary }]}>
          {exercise.totalSessions} session{exercise.totalSessions !== 1 ? "s" : ""} · {formatLastUsed(exercise.lastUsed)}
        </ThemedText>
      </View>
      <View style={styles.exerciseRowRight}>
        <ThemedText style={[styles.exerciseRowWeight, { color: Colors.light.primary }]}>
          {exercise.bestSession.maxWeight}kg
        </ThemedText>
        <ThemedText style={[styles.exerciseRowWeightLabel, { color: theme.textSecondary }]}>
          best
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

  if (!exercise) return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
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
            {exercise.exerciseName}
          </ThemedText>
          <Pressable onPress={onClose} style={styles.modalClose}>
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
              <ThemedText style={[styles.modalStatValue, { color: Colors.light.primary }]}>
                {exercise.totalSessions}
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                Sessions
              </ThemedText>
            </View>
            <View style={[styles.modalStatCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.modalStatValue, { color: "#10B981" }]}>
                {exercise.bestSession.maxWeight}kg
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                Best Weight
              </ThemedText>
            </View>
            <View style={[styles.modalStatCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.modalStatValue, { color: "#8B5CF6" }]}>
                {exercise.bestSession.estimated1RM}kg
              </ThemedText>
              <ThemedText style={[styles.modalStatLabel, { color: theme.textSecondary }]}>
                Est. 1RM
              </ThemedText>
            </View>
          </View>

          {hasChartData ? (
            <>
              {/* Max Weight chart */}
              <View style={[styles.modalChartCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.modalChartHeader}>
                  <ThemedText style={styles.modalChartTitle}>Max Weight</ThemedText>
                  <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>kg</ThemedText>
                </View>
                <SvgLineChart data={weightData} color={Colors.light.primary} chartId="weight" />
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
                  <ThemedText style={styles.modalChartTitle}>Estimated 1RM</ThemedText>
                  <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>kg</ThemedText>
                </View>
                <SvgLineChart data={ormData} color="#8B5CF6" chartId="orm" />
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
                <ThemedText style={styles.modalChartTitle}>First Session</ThemedText>
                <ThemedText style={[styles.modalChartUnit, { color: theme.textSecondary }]}>
                  {formatDate(exercise.sessions[0].date)}
                </ThemedText>
              </View>
              <View style={styles.singleSessionStatsRow}>
                <View style={styles.singleSessionStat}>
                  <View style={styles.singleSessionValueRow}>
                    <ThemedText style={[styles.singleSessionValue, { color: Colors.light.primary }]}>
                      {exercise.sessions[0].maxWeight}kg
                    </ThemedText>
                    <View style={styles.pbBadge}>
                      <ThemedText style={styles.pbBadgeText}>PB</ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    Weight
                  </ThemedText>
                </View>
                <View style={[styles.singleSessionDivider, { backgroundColor: theme.border }]} />
                <View style={styles.singleSessionStat}>
                  <ThemedText style={[styles.singleSessionValue, { color: theme.text }]}>
                    {exercise.sessions[0].maxWeightReps}
                  </ThemedText>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    Reps
                  </ThemedText>
                </View>
                <View style={[styles.singleSessionDivider, { backgroundColor: theme.border }]} />
                <View style={styles.singleSessionStat}>
                  <ThemedText style={[styles.singleSessionValue, { color: "#8B5CF6" }]}>
                    {exercise.sessions[0].estimated1RM}kg
                  </ThemedText>
                  <ThemedText style={[styles.singleSessionLabel, { color: theme.textSecondary }]}>
                    Est. 1RM
                  </ThemedText>
                </View>
              </View>
              <View style={styles.logAgainRow}>
                <Feather name="trending-up" size={13} color={theme.textSecondary} />
                <ThemedText style={[styles.logAgainText, { color: theme.textSecondary }]}>
                  Log again to see progress charts
                </ThemedText>
              </View>
            </View>
          )}

          {/* Best session card with Personal Best badge */}
          <View style={[styles.modalBestSession, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.bestSessionIcon, { backgroundColor: Colors.light.primary + "15" }]}>
              <Feather name="award" size={20} color={Colors.light.primary} />
            </View>
            <View style={styles.bestSessionInfo}>
              <ThemedText style={styles.modalChartTitle}>Best Session</ThemedText>
              <ThemedText style={[styles.bestSessionDate, { color: theme.textSecondary }]}>
                {formatDate(exercise.bestSession.date)}
              </ThemedText>
              <View style={styles.bestSessionWeightRow}>
                <ThemedText style={[styles.bestSessionStats, { color: theme.text }]}>
                  {exercise.bestSession.maxWeight}kg × {exercise.bestSession.maxWeightReps} reps
                </ThemedText>
                <View style={styles.pbBadge}>
                  <ThemedText style={styles.pbBadgeText}>Personal Best</ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.bestSessionStats, { color: theme.textSecondary }]}>
                Est. 1RM: {exercise.bestSession.estimated1RM}kg
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
  const [selectedExercise, setSelectedExercise] = useState<ExerciseProgressData | null>(null);

  if (data.length === 0) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(index * 100).duration(400)}
        style={styles.sectionHeader}
      >
        <ThemedText style={styles.sectionTitle}>Exercise Progress</ThemedText>
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
  const { theme } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name="bar-chart-2" size={48} color={Colors.light.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No Workouts Yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Complete your first workout to start tracking your progress and see your gains
      </ThemedText>
    </View>
  );
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
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

  const calculateStreak = () => {
    if (history.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedHistory = [...history].sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);

      const hasWorkout = sortedHistory.some((session) => {
        const sessionDate = new Date(session.completedAt);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === checkDate.getTime();
      });

      if (hasWorkout) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  };

  const getThisWeekCount = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return history.filter(
      (session) => new Date(session.completedAt) >= startOfWeek
    ).length;
  };

  const getTotalVolume = useMemo(() => {
    return history.reduce((total, session) => {
      if (!session.exerciseProgress) return total;
      return (
        total +
        session.exerciseProgress.reduce((epTotal, ep) => {
          return (
            epTotal +
            ep.sets
              .filter((s) => s.completed)
              .reduce((setTotal, s) => {
                const weight = parseFloat(s.weight) || 0;
                const reps = parseInt(s.reps) || 0;
                return setTotal + weight * reps;
              }, 0)
          );
        }, 0)
      );
    }, 0);
  }, [history]);

  const getWeeklyVolumeData = useMemo(() => {
    const weeks: { week: string; volume: number }[] = [];
    const now = new Date();

    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() - i * 7);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekVolume = history
        .filter((session) => {
          const sessionDate = new Date(session.completedAt);
          return sessionDate >= weekStart && sessionDate < weekEnd;
        })
        .reduce((total, session) => {
          if (!session.exerciseProgress) return total;
          return (
            total +
            session.exerciseProgress.reduce((epTotal, ep) => {
              return (
                epTotal +
                ep.sets
                  .filter((s) => s.completed)
                  .reduce((setTotal, s) => {
                    const weight = parseFloat(s.weight) || 0;
                    const reps = parseInt(s.reps) || 0;
                    return setTotal + weight * reps;
                  }, 0)
              );
            }, 0)
          );
        }, 0);

      const weekLabel =
        i === 0
          ? "This"
          : i === 1
          ? "Last"
          : `${i}w`;

      weeks.push({ week: weekLabel, volume: weekVolume });
    }

    return weeks;
  }, [history]);

  const getMuscleBalanceData = useMemo(() => {
    const muscleData: Record<string, number> = {};

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    history
      .filter((session) => new Date(session.completedAt) >= thirtyDaysAgo)
      .forEach((session) => {
        session.exercises.forEach((exercise, idx) => {
          const muscleGroup = exercise.muscleGroup;
          const completedSets =
            session.exerciseProgress?.[idx]?.sets.filter((s) => s.completed)
              .length || 0;

          if (!muscleData[muscleGroup]) {
            muscleData[muscleGroup] = 0;
          }
          muscleData[muscleGroup] += completedSets;
        });
      });

    return MUSCLE_GROUPS.map((mg) => ({
      name: mg.name,
      sets: muscleData[mg.name] || 0,
      color: mg.color,
    })).sort((a, b) => b.sets - a.sets);
  }, [history]);

  const getOneRMData = useMemo(() => {
    const liftColors: Record<string, string> = {
      "Barbell Bench Press": Colors.light.primary,
      "Barbell Back Squat": "#8B5CF6",
      "Barbell Deadlift": "#10B981",
      "Barbell Overhead Press": "#3B82F6",
      "Barbell Bent-Over Row": "#F59E0B",
      "Machine Leg Press": "#06B6D4",
    };

    return COMPOUND_LIFTS.map(liftName => {
      const liftHistory: { date: string; estimated1RM: number }[] = [];

      history.forEach(session => {
        session.exercises.forEach((exercise, idx) => {
          if (exercise.name === liftName && session.exerciseProgress?.[idx]) {
            const sets = session.exerciseProgress[idx].sets.filter(s => s.completed);
            if (sets.length > 0) {
              const bestSet = sets.reduce((best, set) => {
                const weight = parseFloat(set.weight) || 0;
                const reps = parseInt(set.reps) || 0;
                const est1RM = calculate1RM(weight, reps);
                const bestEst = calculate1RM(parseFloat(best.weight) || 0, parseInt(best.reps) || 0);
                return est1RM > bestEst ? set : best;
              });
              const weight = parseFloat(bestSet.weight) || 0;
              const reps = parseInt(bestSet.reps) || 0;
              if (weight > 0 && reps > 0) {
                liftHistory.push({
                  date: session.completedAt,
                  estimated1RM: calculate1RM(weight, reps),
                });
              }
            }
          }
        });
      });

      liftHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return {
        exercise: liftName,
        history: liftHistory,
        color: liftColors[liftName] || Colors.light.primary,
      };
    });
  }, [history]);

  const getWeeklyHeatmapData = useMemo(() => {
    const muscleData: Record<string, number> = {};
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    history
      .filter(session => new Date(session.completedAt) >= startOfWeek)
      .forEach(session => {
        session.exercises.forEach((exercise, idx) => {
          const muscleGroup = exercise.muscleGroup;
          const completedSets = session.exerciseProgress?.[idx]?.sets.filter(s => s.completed).length || 0;
          if (!muscleData[muscleGroup]) muscleData[muscleGroup] = 0;
          muscleData[muscleGroup] += completedSets;
        });
      });

    return MUSCLE_GROUPS.map(mg => ({
      name: mg.name,
      sets: muscleData[mg.name] || 0,
      intensity: muscleData[mg.name] || 0,
    }));
  }, [history]);

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
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
        history.length === 0 && styles.emptyContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.light.primary}
        />
      }
    >
      {history.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              icon="activity"
              label="Total Workouts"
              value={history.length.toString()}
              color={Colors.light.primary}
              index={0}
            />
            <StatCard
              icon="zap"
              label="Day Streak"
              value={calculateStreak().toString()}
              color="#FFB800"
              index={1}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon="calendar"
              label="This Week"
              value={getThisWeekCount().toString()}
              color={Colors.light.success}
              index={2}
            />
            <StatCard
              icon="trending-up"
              label="Total Volume"
              value={`${(getTotalVolume / 1000).toFixed(0)}k`}
              subtitle="kg"
              color="#9B59B6"
              index={3}
            />
          </View>

          <VolumeChart data={getWeeklyVolumeData} index={4} />

          <OneRMChart data={getOneRMData} index={5} />

          <MuscleHeatmap data={getWeeklyHeatmapData} index={6} />

          <MuscleBalance data={getMuscleBalanceData} index={7} />

          <ExerciseProgressSection data={getExerciseProgressData} index={8} />

          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            style={styles.sectionHeader}
          >
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
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

const styles = StyleSheet.create({
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
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
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
    borderColor: "#E8E8E8",
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
    fontFamily: "Montserrat_600SemiBold",
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
    borderColor: "#E8E8E8",
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
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
    borderColor: "#E8E8E8",
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontFamily: "Montserrat_600SemiBold",
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
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  oneRMContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  oneRMBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  oneRMBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
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
    borderColor: "#E8E8E8",
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
    borderRadius: 10,
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
    borderColor: "#E8E8E8",
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
    fontFamily: "Montserrat_600SemiBold",
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
    fontFamily: "Montserrat_700Bold",
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
    backgroundColor: "#C7C7CC",
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
    fontFamily: "Montserrat_700Bold",
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
    borderColor: "#E8E8E8",
  },
  modalStatValue: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
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
    borderColor: "#E8E8E8",
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
    fontFamily: "Montserrat_600SemiBold",
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
    borderColor: "#E8E8E8",
  },
  bestSessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: Colors.light.primary + "20",
  },
  pbBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: Colors.light.primary,
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
    fontFamily: "Montserrat_700Bold",
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
    borderTopColor: "#E8E8E8",
  },
  logAgainText: {
    fontSize: 12,
  },
});
