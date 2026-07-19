import React from "react";
import { View, StyleSheet, Pressable, Dimensions } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import {
  buildHybridPeriodReport,
  formatDurationHuman,
  type ProgressPeriod,
  type HybridPeriodReport,
} from "@/lib/hybridProgressReport";
import type { WorkoutSession } from "@/lib/storage";
import { useTheme } from "@/hooks/useTheme";

const PERIODS: ProgressPeriod[] = ["week", "month", "year"];
const CHART_W = Dimensions.get("window").width - Spacing.xl * 2 - Spacing.lg * 2;

type Props = {
  history: WorkoutSession[];
  period: ProgressPeriod;
  onPeriodChange: (p: ProgressPeriod) => void;
};

function DonutChart({
  slices,
  size = 120,
}: {
  slices: HybridPeriodReport["distribution"];
  size?: number;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const total = slices.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${cx}, ${cy}`}>
        {slices.map((slice) => {
          const frac = slice.count / total;
          const dash = circumference * frac;
          const el = (
            <Circle
              key={slice.key}
              cx={cx}
              cy={cy}
              r={radius}
              stroke={slice.color}
              strokeWidth={stroke}
              fill="transparent"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </G>
    </Svg>
  );
}

function MetricTile({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.metricTile, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + "18" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <ThemedText style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

export function HybridProgressPanel({ history, period, onPeriodChange }: Props) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const report = buildHybridPeriodReport(history, period, t, new Date(), i18n.language);

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <View style={styles.headerRow}>
        <View>
          <ThemedText style={styles.reportTitle}>{t("progress.hybrid.title")}</ThemedText>
          <ThemedText style={[styles.reportRange, { color: theme.textSecondary }]}>
            {report.rangeLabel}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.segmented, { backgroundColor: theme.backgroundDefault }]}>
        {PERIODS.map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => onPeriodChange(p)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                  !active && { color: theme.textSecondary },
                ]}
              >
                {t(`progress.hybrid.period.${p}`)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.metricGrid}>
        <MetricTile
          icon="activity"
          label={t("progress.hybrid.strengthSessions")}
          value={t("progress.hybrid.countStrength", { count: report.strengthCount })}
          color={Colors.light.primary}
        />
        <MetricTile
          icon="zap"
          label={t("progress.hybrid.cardioSessions")}
          value={t("progress.hybrid.countCardio", { count: report.cardioCount })}
          color="#F59E0B"
        />
        <MetricTile
          icon="clock"
          label={t("progress.hybrid.totalDuration")}
          value={formatDurationHuman(report.totalDurationMinutes, t)}
          color="#10B981"
        />
        <MetricTile
          icon="map-pin"
          label={t("progress.hybrid.totalDistance")}
          value={
            report.totalDistanceKm > 0
              ? t("progress.hybrid.distanceKm", { km: report.totalDistanceKm })
              : "—"
          }
          color="#3B82F6"
        />
      </View>

      {report.distribution.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.cardTitle}>{t("progress.hybrid.distributionTitle")}</ThemedText>
          <View style={styles.distributionRow}>
            <DonutChart slices={report.distribution} />
            <View style={styles.legendList}>
              {report.distribution.map((slice) => (
                <View key={slice.key} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                  <ThemedText style={styles.legendLabel} numberOfLines={1}>
                    {slice.label}
                  </ThemedText>
                  <ThemedText style={[styles.legendPct, { color: theme.textSecondary }]}>
                    {slice.percent}%
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.barStack}>
            {report.distribution.map((slice) => (
              <View
                key={slice.key}
                style={[
                  styles.barSegment,
                  {
                    flex: slice.percent,
                    backgroundColor: slice.color,
                    minWidth: slice.percent > 0 ? 4 : 0,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {report.rpeTrend.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.cardHeader}>
            <ThemedText style={styles.cardTitle}>{t("progress.hybrid.rpeTrendTitle")}</ThemedText>
            {report.avgRpe !== null ? (
              <ThemedText style={[styles.avgBadge, { color: theme.textSecondary }]}>
                {t("progress.hybrid.avgRpe", { rpe: report.avgRpe })}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.rpeChart}>
            {report.rpeTrend.map((point) => {
              const heightPct = (point.avgRpe / 10) * 100;
              const tone =
                point.avgRpe >= 8.5
                  ? "#EF4444"
                  : point.avgRpe >= 7
                    ? "#F59E0B"
                    : Colors.light.primary;
              return (
                <View key={point.label} style={styles.rpeCol}>
                  <ThemedText style={[styles.rpeValue, { color: tone }]}>
                    {point.avgRpe}
                  </ThemedText>
                  <View style={[styles.rpeTrack, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.rpeFill,
                        { height: `${heightPct}%`, backgroundColor: tone },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.rpeLabel, { color: theme.textSecondary }]}>
                    {point.label}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <ThemedText style={[styles.rpeHint, { color: theme.textSecondary }]}>
            {report.avgRpe !== null && report.avgRpe >= 8
              ? t("progress.hybrid.rpeHighHint")
              : t("progress.hybrid.rpeBalancedHint")}
          </ThemedText>
        </View>
      ) : null}

      {report.highlights.length > 0 ? (
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.cardTitle}>{t("progress.hybrid.highlightsTitle")}</ThemedText>
          {report.highlights.map((h, idx) => (
            <View
              key={h.id}
              style={[
                styles.highlightRow,
                idx < report.highlights.length - 1 && styles.highlightBorder,
              ]}
            >
              <View style={styles.highlightIcon}>
                <Feather name={h.icon} size={18} color={Colors.light.primary} />
              </View>
              <View style={styles.highlightCopy}>
                <ThemedText style={styles.highlightTitle}>{h.title}</ThemedText>
                <ThemedText style={[styles.highlightSub, { color: theme.textSecondary }]}>
                  {h.subtitle}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {report.filteredSessions.length === 0 ? (
        <View style={[styles.emptyPeriod, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="bar-chart-2" size={28} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyPeriodText, { color: theme.textSecondary }]}>
            {t("progress.hybrid.emptyPeriod")}
          </ThemedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: Spacing.md,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  reportRange: {
    fontSize: 13,
    marginTop: 2,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: BorderRadius.sm - 2,
  },
  segmentActive: {
    backgroundColor: Colors.light.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metricTile: {
    width: (CHART_W - Spacing.sm) / 2,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  legendList: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  legendPct: {
    fontSize: 13,
    fontWeight: "600",
  },
  barStack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barSegment: {
    height: "100%",
  },
  rpeChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    gap: 4,
  },
  rpeCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  rpeValue: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  rpeTrack: {
    width: "70%",
    height: 72,
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  rpeFill: {
    width: "100%",
    borderRadius: 4,
  },
  rpeLabel: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: "500",
  },
  rpeHint: {
    fontSize: 12,
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  avgBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  highlightBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  highlightCopy: { flex: 1 },
  highlightTitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  highlightSub: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyPeriod: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyPeriodText: {
    fontSize: 14,
    textAlign: "center",
  },
});
