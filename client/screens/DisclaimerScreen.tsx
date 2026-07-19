import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemedText } from "@/components/ThemedText";
import { HEVY } from "@/constants/hevyLayout";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  Colors,
  Typography,
} from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  getOnboardingComplete,
  setDisclaimerAccepted,
} from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Keine medizinische Beratung",
    body:
      "Die Informationen, Trainingspläne und Gewichtsempfehlungen dienen nur der Information und Unterhaltung. Sie ersetzen keine ärztliche oder therapeutische Beratung, Diagnose oder Behandlung.",
  },
  {
    title: "Training auf eigene Gefahr",
    body:
      "Die Nutzung der App und das Ausführen der Übungen erfolgen auf eigenes Risiko. Vor einem neuen Programm solltest du einen Arzt einbeziehen — besonders bei Vorerkrankungen oder Beschwerden.",
  },
  {
    title: "KI-generierte Inhalte",
    body:
      "Die App nutzt KI für Pläne und Empfehlungen. KI kann irren oder ungeeignete Übungen vorschlagen. Höre auf deinen Körper. Bei Schmerzen die Übung sofort abbrechen.",
  },
  {
    title: "Haftungsbeschränkung",
    body:
      "Der Betreiber haftet nicht für Verletzungen, Gesundheitsschäden oder Unfälle im Zusammenhang mit der Nutzung der Inhalte.",
  },
];

export default function DisclaimerScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [submitting, setSubmitting] = useState(false);
  const scale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onAccept = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await setDisclaimerAccepted(true);
      const onboardingDone = await getOnboardingComplete();
      navigation.reset({
        index: 0,
        routes: [{ name: onboardingDone ? "Main" : "Onboarding" }],
      });
    } finally {
      setSubmitting(false);
    }
  }, [navigation, submitting]);

  const cardBg = isDark ? theme.backgroundSecondary : theme.backgroundDefault;
  const accentBar = Colors.light.primary;

  return (
    <View style={[styles.root, { backgroundColor: HEVY.canvas }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.delay(80).duration(500)} style={styles.hero}>
          <BrandLogo height={48} style={styles.brandMark} />
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: theme.backgroundTertiary,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={36} color={accentBar} />
          </View>
          <ThemedText type="h1" style={styles.headline}>
            Wichtiger Hinweis
          </ThemedText>
          <ThemedText
            style={[styles.lead, { color: theme.textSecondary }]}
          >
            Bitte lies den Haftungsausschluss, bevor du TrackYourLift nutzt.
          </ThemedText>
        </Animated.View>

        {SECTIONS.map((block, idx) => (
          <Animated.View
            key={block.title}
            entering={FadeInUp.delay(120 + idx * 70).duration(450)}
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.cardAccent, { backgroundColor: accentBar }]} />
            <View style={styles.cardInner}>
              <ThemedText type="h4" style={styles.cardTitle}>
                {block.title}
              </ThemedText>
              <ThemedText
                style={[styles.cardBody, { color: theme.textSecondary }]}
              >
                {block.body}
              </ThemedText>
            </View>
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.delay(420).duration(500)}>
          <ThemedText
            style={[styles.footnote, { color: theme.textSecondary }]}
          >
            Mit der Bestätigung erklärst du, den Hinweis gelesen zu haben und mit
            den Bedingungen einverstanden zu sein.
          </ThemedText>
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            paddingHorizontal: Spacing.xl,
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundRoot,
          },
        ]}
      >
        <AnimatedPressable
          disabled={submitting}
          onPress={onAccept}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 16, stiffness: 180 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 16, stiffness: 180 });
          }}
          style={animatedButtonStyle}
          testID="button-disclaimer-accept"
        >
          <View
            style={[
              styles.cta,
              submitting && styles.ctaDisabled,
              { backgroundColor: Colors.light.primary },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.light.buttonText} />
            ) : (
              <ThemedText style={styles.ctaText}>
                Ich habe verstanden und akzeptiere
              </ThemedText>
            )}
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  brandMark: {
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  headline: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  lead: {
    ...Typography.body,
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 22,
  },
  card: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  cardAccent: {
    width: 4,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.lg,
  },
  cardTitle: {
    marginBottom: Spacing.sm,
  },
  cardBody: {
    ...Typography.small,
    lineHeight: 20,
  },
  footnote: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.md,
    lineHeight: 18,
    opacity: 0.95,
  },
  footer: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: {
    opacity: 0.85,
  },
  ctaText: {
    color: Colors.light.buttonText,
    fontFamily: Typography.h3.fontFamily,
    fontWeight: "700",
    fontSize: 16,
  },
});
