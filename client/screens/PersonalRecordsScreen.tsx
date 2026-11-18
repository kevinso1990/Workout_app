import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { ScreenGradient } from "@/components/surface/ScreenGradient";
import { PanelFill, panelFrame } from "@/components/surface/Panel";
import {
  ShareRecordSheet,
  recordValue,
  type ShareableRecord,
} from "@/components/records/ShareRecordSheet";
import { useTheme } from "@/hooks/useTheme";
import { FontFamily, Spacing, loadTier, plateColor } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { HEVY, hevyHairline, hevyHeaderInsets } from "@/constants/hevyLayout";
import { getWorkoutHistory } from "@/lib/storage";
import { personalBests, type PersonalBest } from "@/lib/strengthProgress";
import { localizeExerciseName } from "@/lib/exerciseNameCatalog";

/**
 * Every exercise's all-time best in one list, newest first — the "Neue
 * Rekorde" card only covers 30 days. Each one can be shared as a card.
 */
export default function PersonalRecordsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [bests, setBests] = useState<PersonalBest[] | null>(null);
  const [sharing, setSharing] = useState<ShareableRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getWorkoutHistory().then((h) => {
        if (!cancelled) setBests(personalBests(h));
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short", year: "numeric" });

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <View style={[hevyHeaderInsets(insets.top), hevyHairline]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Feather name="chevron-left" size={28} color={theme.chalk} />
        </Pressable>
        <ThemedText style={styles.title}>{t("records.title")}</ThemedText>
        {bests ? (
          <ThemedText style={styles.subtitle}>
            {t("records.count", { count: bests.length })}
          </ThemedText>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        {bests && bests.length === 0 ? (
          <ThemedText style={styles.empty}>{t("records.empty")}</ThemedText>
        ) : null}
        {bests && bests.length > 0 ? (
          <View style={[styles.panel, panelFrame(theme)]}>
            <PanelFill />
            {bests.map((item, index) => (
              <View
                key={item.exerciseName}
                style={[styles.row, index > 0 && styles.rowDivider]}
                testID={`record-row-${index}`}
              >
                {/* Load colour, as on the set rows — the only colour here. */}
                <View
                  style={[
                    styles.spine,
                    {
                      backgroundColor:
                        item.weight > 0 ? plateColor(loadTier(item.weight)) : theme.hairlineStrong,
                    },
                  ]}
                />
                <View style={styles.rowText}>
                  <ThemedText style={styles.name} numberOfLines={2}>
                    {localizeExerciseName(item.exerciseName, i18n.language)}
                  </ThemedText>
                  <ThemedText style={styles.value}>{recordValue(t, item)}</ThemedText>
                  <ThemedText style={styles.meta} numberOfLines={1}>
                    {item.estimated1RM > 0
                      ? `${t("records.e1rm", { kg: item.estimated1RM })} · ${dateLabel(item.date)}`
                      : dateLabel(item.date)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setSharing(item)}
                  hitSlop={10}
                  style={[styles.shareBtn, { borderColor: theme.controlOutline }]}
                  accessibilityRole="button"
                  accessibilityLabel={t("records.share")}
                  testID={`button-share-record-${index}`}
                >
                  <Feather name="share" size={16} color={theme.chalk} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ShareRecordSheet record={sharing} onClose={() => setSharing(null)} />
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.backgroundRoot,
    },
    backBtn: {
      alignSelf: "flex-start",
      marginBottom: 8,
      marginLeft: -4,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      fontFamily: "Archivo_700Bold",
      color: c.chalk,
      letterSpacing: -0.5,
      lineHeight: 34,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: c.chalkDim,
    },
    list: {
      padding: HEVY.pad,
    },
    panel: {
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      paddingLeft: Spacing.lg + 4,
      paddingRight: Spacing.md,
    },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.hairline,
    },
    spine: {
      position: "absolute",
      left: 0,
      top: Spacing.md,
      bottom: Spacing.md,
      width: 3,
      borderRadius: 2,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      color: c.chalk,
    },
    value: {
      fontFamily: FontFamily.mono,
      fontSize: 17,
      color: c.chalk,
    },
    meta: {
      fontSize: 13,
      color: c.textSecondary,
    },
    shareBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      textAlign: "center",
      color: c.textSecondary,
      marginTop: Spacing["2xl"],
      lineHeight: 22,
    },
  });
