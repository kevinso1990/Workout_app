import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, FontFamily, Spacing, loadTier, plateColor } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { localizeExerciseName } from "@/lib/exerciseNameCatalog";

export interface ShareableRecord {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  estimated1RM: number;
}

export function recordValue(
  t: (key: string, o?: Record<string, unknown>) => string,
  r: Pick<ShareableRecord, "weight" | "reps">,
): string {
  return r.weight > 0
    ? `${formatKg(r.weight)} kg × ${r.reps}`
    : t("records.repsOnly", { count: r.reps });
}

export function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : kg.toFixed(1);
}

/**
 * A personal best as a card worth posting: previewed here, shared as an image
 * (or as text where the image can't be made). The left spine is the load
 * plate colour, the one place the card carries colour.
 */
export function ShareRecordSheet({
  record,
  onClose,
}: {
  record: ShareableRecord | null;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  if (!record) return null;

  const name = localizeExerciseName(record.exerciseName, i18n.language);
  const value = recordValue(t, record);
  const date = new Date(record.date).toLocaleDateString(i18n.language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSharing(true);
    try {
      const { captureRef } = await import("react-native-view-shot");
      const Sharing = await import("expo-sharing");
      const uri = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png" });
        return;
      }
      throw new Error("sharing unavailable");
    } catch {
      // No image (module missing, capture failed): the record as text still travels.
      await Share.share({ message: t("records.shareText", { name, value }) }).catch(() => {});
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View ref={cardRef} collapsable={false} style={styles.card} testID="share-record-card">
            <LinearGradient
              colors={[theme.groundTop, theme.groundBottom]}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.spine,
                { backgroundColor: record.weight > 0 ? plateColor(loadTier(record.weight)) : theme.chalkFaint },
              ]}
            />
            <BrandLogo height={26} centered={false} />
            <View style={styles.cardBody}>
              <ThemedText style={styles.overline}>{t("records.cardOverline")}</ThemedText>
              <ThemedText style={styles.cardName} numberOfLines={3}>
                {name}
              </ThemedText>
              <ThemedText style={styles.cardValue} adjustsFontSizeToFit numberOfLines={1}>
                {value}
              </ThemedText>
              {record.estimated1RM > 0 ? (
                <ThemedText style={styles.cardMeta}>
                  {t("records.e1rm", { kg: record.estimated1RM })}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={styles.cardDate}>{date}</ThemedText>
          </View>

          <Pressable
            onPress={() => void share()}
            disabled={sharing}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            testID="button-share-record"
          >
            {sharing ? (
              <ActivityIndicator color={theme.onChalk} />
            ) : (
              <>
                <Feather name="share" size={18} color={theme.onChalk} />
                <ThemedText style={styles.shareText}>{t("records.share")}</ThemedText>
              </>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <ThemedText style={styles.closeText}>{t("common.close")}</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    sheet: {
      backgroundColor: c.backgroundDefault,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    card: {
      aspectRatio: 4 / 5,
      borderRadius: BorderRadius.lg,
      overflow: "hidden",
      padding: Spacing.xl,
      paddingLeft: Spacing.xl + 8,
      justifyContent: "space-between",
    },
    spine: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 8,
    },
    cardBody: {
      gap: Spacing.sm,
    },
    overline: {
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 2,
      color: c.chalkDim,
    },
    cardName: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      lineHeight: 40,
      color: c.chalk,
      textTransform: "uppercase",
    },
    cardValue: {
      fontFamily: FontFamily.mono,
      fontSize: 44,
      lineHeight: 54,
      color: c.chalk,
    },
    cardMeta: {
      fontSize: 15,
      color: c.chalkDim,
    },
    cardDate: {
      fontSize: 14,
      color: c.chalkDim,
    },
    shareBtn: {
      height: 52,
      borderRadius: BorderRadius.full,
      backgroundColor: c.chalk,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    shareText: {
      fontSize: 16,
      fontWeight: "700",
      color: c.onChalk,
    },
    closeBtn: {
      alignSelf: "center",
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    closeText: {
      fontSize: 15,
      color: c.textSecondary,
    },
  });
