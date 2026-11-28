import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import { useTheme } from "@/hooks/useTheme";
import type { MainTabParamList } from "@/navigation/MainTabNavigator";
import ProgressScreen from "@/screens/ProgressScreen";
import CalendarScreen from "@/screens/CalendarScreen";

export type ProgressView = "overview" | "calendar";

/**
 * Progress and the month calendar share one tab. The week lives on the home
 * tab, the month here — three calendars (home week, calendar tab, streak card)
 * told the same story and cost a whole tab.
 */
export default function ProgressTabScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const route = useRoute<RouteProp<MainTabParamList, "Progress">>();
  const navigation = useNavigation();
  const [view, setView] = useState<ProgressView>(route.params?.view ?? "overview");

  // The home week strip opens the calendar here. The param is consumed, so
  // the next tap from home works after switching back to the overview.
  useEffect(() => {
    if (!route.params?.view) return;
    setView(route.params.view);
    navigation.setParams({ view: undefined } as never);
  }, [route.params?.view, navigation]);

  const header = (
    <View style={styles.segmented} accessibilityRole="tablist">
      {(["overview", "calendar"] as const).map((v) => {
        const active = view === v;
        return (
          <Pressable
            key={v}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              setView(v);
            }}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={`progress-view-${v}`}
          >
            <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>
              {t(v === "overview" ? "progress.viewOverview" : "progress.viewCalendar")}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );

  return view === "overview" ? <ProgressScreen header={header} /> : <CalendarScreen header={header} />;
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    segmented: {
      flexDirection: "row",
      backgroundColor: c.well,
      borderRadius: BorderRadius.md,
      padding: 3,
      gap: 3,
      marginBottom: Spacing.lg,
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignItems: "center",
    },
    segmentActive: {
      backgroundColor: c.primary,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: "600",
      color: c.chalkDim,
    },
    segmentTextActive: {
      color: c.onChalk,
    },
  });
