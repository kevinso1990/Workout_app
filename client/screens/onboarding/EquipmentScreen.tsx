import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useOnboarding, Equipment } from "@/context/OnboardingContext";
import { OnboardingStackParamList } from "@/navigation/OnboardingStackNavigator";
import { screenHeaderSafeAreaStyle } from "@/lib/paddingTopUnderHeader";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { OnboardingHeading } from "@/components/onboarding/OnboardingHeading";

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, "Equipment">;

const EQUIPMENT_OPTIONS: {
  id: Equipment;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  mciIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  {
    id: "full_gym",
    title: "Full Gym Access",
    description: "Barbells, dumbbells, cables, machines",
    icon: "zap",
  },
  {
    id: "dumbbells_only",
    title: "Dumbbells Only",
    description: "Home setup with adjustable dumbbells",
    icon: "disc",
  },
  {
    id: "kettlebell",
    title: "Kettlebells Only",
    description: "Kettlebell-exclusive training",
    icon: "anchor",
    mciIcon: "kettlebell",
  },
  {
    id: "bodyweight",
    title: "Bodyweight Only",
    description: "No equipment needed",
    icon: "user",
  },
];

export default function EquipmentScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { state, setEquipment } = useOnboarding();

  const handleSelect = (equipment: Equipment) => {
    Haptics.selectionAsync();
    setEquipment(equipment);
  };

  const handleContinue = () => {
    if (state.equipment) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate("Goals");
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { flex: 1, backgroundColor: theme.backgroundRoot, ...screenHeaderSafeAreaStyle(insets.top) },
      ]}
    >
      <ProgressBar showBrand step={1} total={4} style={{ marginBottom: Spacing.xl }} />

      <Animated.View entering={FadeInDown.duration(400)}>
        <OnboardingHeading
          title={t("onboarding.equipmentQuestion")}
          subtitle={t("onboarding.equipmentSubtitle")}
        />
      </Animated.View>

      <View style={styles.options}>
        {EQUIPMENT_OPTIONS.map((option, index) => {
          const isSelected = state.equipment === option.id;
          return (
            <Animated.View
              key={option.id}
              entering={FadeInDown.delay(100 + index * 80).duration(400)}
            >
              <Pressable
                onPress={() => handleSelect(option.id)}
                testID={`button-equipment-${option.id}`}
                style={[
                  styles.optionCard,
                  { backgroundColor: theme.backgroundDefault },
                  isSelected && { borderColor: Colors.light.primary, borderWidth: 2 },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: isSelected
                        ? Colors.light.primary + "20"
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  {option.mciIcon ? (
                    <MaterialCommunityIcons
                      name={option.mciIcon}
                      size={22}
                      color={isSelected ? Colors.light.primary : theme.textSecondary}
                    />
                  ) : (
                    <Feather
                      name={option.icon}
                      size={22}
                      color={isSelected ? Colors.light.primary : theme.textSecondary}
                    />
                  )}
                </View>
                <View style={styles.optionContent}>
                  <ThemedText style={styles.optionTitle}>
                    {t(`onboarding.equipmentOptions.${option.id}.title`)}
                  </ThemedText>
                  <ThemedText
                    style={[styles.optionDescription, { color: theme.textSecondary }]}
                  >
                    {t(`onboarding.equipmentOptions.${option.id}.description`)}
                  </ThemedText>
                </View>
                {isSelected ? (
                  <Feather name="check-circle" size={24} color={Colors.light.primary} />
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            testID="button-back"
            style={[styles.backButton, { borderColor: "#E8E8E8" }]}
          >
            <ThemedText style={styles.backText}>{t("onboarding.back")}</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleContinue}
            testID="button-continue"
            disabled={!state.equipment}
            style={[styles.continueWrapper, { opacity: state.equipment ? 1 : 0.5 }]}
          >
            <View style={[styles.continueButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={styles.continueText}>{t("onboarding.next")}</ThemedText>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
  },
  options: {
    flex: 1,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  backButton: {
    height: 54,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backText: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  continueWrapper: {
    flex: 1,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  continueText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
});
