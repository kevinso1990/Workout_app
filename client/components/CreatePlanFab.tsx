import React, { useState } from "react";
import { Platform, StyleSheet, Pressable, View, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { hapticMedium } from "@/lib/safeHaptics";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CreatePlanFab() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fabBottom = tabBarHeight + Math.max(insets.bottom, 12) + 12;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const openSheet = () => {
    hapticMedium();
    setSheetOpen(true);
  };

  const closeSheet = () => setSheetOpen(false);

  const goStrength = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("StartWorkout", {});
  };

  const goCardio = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("LogCardio");
  };

  const goCreatePlan = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("CreatePlan");
  };

  const goGoalPlan = () => {
    closeSheet();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("GoalPlan");
  };

  return (
    <>
      <View
        style={[
          styles.container,
          Platform.OS === "web" ? styles.containerWeb : null,
          { bottom: fabBottom },
        ]}
        pointerEvents="box-none"
      >
        <AnimatedPressable
          onPress={openSheet}
          onPressIn={() => {
            scale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
          }}
          style={animatedStyle}
          testID="button-fab-create"
          accessibilityRole="button"
          accessibilityLabel={t("addWorkout.fabLabel")}
        >
          <View style={[styles.fab, { backgroundColor: Colors.light.primary }]}>
            <Feather name="plus" size={28} color="#FFFFFF" />
          </View>
        </AnimatedPressable>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <ThemedText style={styles.sheetTitle}>{t("addWorkout.title")}</ThemedText>

            <Pressable style={styles.sheetItem} onPress={goStrength} testID="button-add-strength">
              <View style={[styles.sheetIcon, { backgroundColor: "#EEF2FF" }]}>
                <Feather name="activity" size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.startStrength")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.startStrengthDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goCardio} testID="button-add-cardio">
              <View style={[styles.sheetIcon, { backgroundColor: "#FEF3C7" }]}>
                <Feather name="zap" size={20} color="#D97706" />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.logCardio")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.logCardioDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItem} onPress={goGoalPlan} testID="button-add-goal-plan">
              <View style={[styles.sheetIcon, { backgroundColor: Colors.light.primary + "1A" }]}>
                <Feather name="target" size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.sheetCopy}>
                <ThemedText style={styles.sheetItemTitle}>
                  {t("addWorkout.goalPlan")}
                </ThemedText>
                <ThemedText style={styles.sheetItemDesc}>
                  {t("addWorkout.goalPlanDesc")}
                </ThemedText>
              </View>
            </Pressable>

            <Pressable style={styles.sheetItemSecondary} onPress={goCreatePlan}>
              <Feather name="clipboard" size={18} color={theme.textSecondary} />
              <ThemedText style={styles.sheetItemSecondaryText}>
                {t("addWorkout.createPlan")}
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.xl,
    zIndex: 1000,
    elevation: 8,
  },
  containerWeb: {
    position: "fixed" as "absolute",
    zIndex: 9999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCopy: { flex: 1 },
  sheetItemTitle: { fontSize: 16, fontWeight: "600" },
  sheetItemDesc: { fontSize: 13, opacity: 0.65, marginTop: 2 },
  sheetItemSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  sheetItemSecondaryText: { fontSize: 14, fontWeight: "500", opacity: 0.75 },
});
