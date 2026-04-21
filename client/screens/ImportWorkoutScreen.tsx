import React, { useState, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useWorkoutImport, ImportedWorkoutPlan, PickedImage } from "@/hooks/useWorkoutImport";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScreenState = "landing" | "selected" | "loading" | "preview" | "success";

function GradientButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
      onPress={onPress}
      style={animatedStyle}
    >
      <LinearGradient
        colors={[Colors.light.primary, Colors.light.primaryGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientButton}
      >
        <Feather name={icon} size={18} color="#FFFFFF" />
        <ThemedText style={styles.gradientButtonText}>{label}</ThemedText>
      </LinearGradient>
    </AnimatedPressable>
  );
}

function OutlineButton({
  label,
  icon,
  onPress,
  small = false,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  small?: boolean;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 200 }); }}
      onPress={onPress}
      style={[
        animatedStyle,
        styles.outlineButton,
        { borderColor: theme.border, backgroundColor: theme.backgroundDefault },
        small && styles.outlineButtonSmall,
      ]}
    >
      <Feather name={icon} size={small ? 15 : 18} color={Colors.light.primary} />
      <ThemedText style={[styles.outlineButtonText, small && styles.outlineButtonTextSmall]}>
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function ImportWorkoutScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { pickImage, analyzeImages, saveImportedPlan } = useWorkoutImport();

  const [screenState, setScreenState] = useState<ScreenState>("landing");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [loadingText, setLoadingText] = useState("Reading your workout plan...");
  const [previewPlan, setPreviewPlan] = useState<ImportedWorkoutPlan | null>(null);
  const [planName, setPlanName] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  useEffect(() => {
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
    };
  }, []);

  const handlePickImage = async (source: "camera" | "library") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const picked = await pickImage(source);
    if (!picked) return;
    const next = [...images, picked];
    setImages(next);
    setScreenState("selected");
    setError(null);
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    if (next.length === 0) setScreenState("landing");
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState("loading");
    setLoadingText("Reading your workout plan...");
    setError(null);

    loadingTimer.current = setTimeout(() => setLoadingText("Almost done..."), 2000);

    try {
      const plan = await analyzeImages(images.map((img) => img.base64));
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      setPreviewPlan(plan);
      setPlanName(plan.planName);
      setExpandedDays(new Set([0]));
      setScreenState("preview");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      setError("Could not read the plan. Try a clearer photo or better lighting.");
      setScreenState("selected");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleSavePlan = async () => {
    if (!previewPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const planId = await saveImportedPlan({ ...previewPlan, planName });
      setSavedPlanId(planId);
      setScreenState("success");
      checkScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      checkOpacity.value = withTiming(1, { duration: 300 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Failed to save plan. Please try again.");
    }
  };

  const handleTryAgain = () => {
    setScreenState("selected");
    setPreviewPlan(null);
    setError(null);
  };

  const toggleDay = (index: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // ── Landing ────────────────────────────────────────────────────────────────
  if (screenState === "landing") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.centeredContent, { paddingTop: headerHeight + Spacing["2xl"] }]}>
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.landingInner}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.light.primary + "15" }]}>
              <Feather name="camera" size={48} color={Colors.light.primary} />
            </View>
            <ThemedText style={styles.landingTitle}>Import Workout Plan</ThemedText>
            <ThemedText style={[styles.landingSubtitle, { color: theme.textSecondary }]}>
              Take a photo or upload a screenshot of any workout plan
            </ThemedText>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.pickButtonRow}>
            <GradientButton label="Take Photo" icon="camera" onPress={() => handlePickImage("camera")} />
            <OutlineButton label="Choose from Library" icon="image" onPress={() => handlePickImage("library")} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <ThemedText style={[styles.hintText, { color: theme.textSecondary }]}>
              Works with handwritten plans, screenshots, PDFs, gym programs — anything
            </ThemedText>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (screenState === "loading") {
    return (
      <View style={[styles.container, styles.centeredContent, { backgroundColor: theme.backgroundRoot }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.loadingInner}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            {loadingText}
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (screenState === "success") {
    return (
      <View style={[styles.container, styles.centeredContent, { backgroundColor: theme.backgroundRoot }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.successInner}>
          <Animated.View style={[styles.checkCircle, { backgroundColor: Colors.light.success + "20" }, checkAnimatedStyle]}>
            <Feather name="check-circle" size={64} color={Colors.light.success} />
          </Animated.View>
          <ThemedText style={styles.successTitle}>Plan imported!</ThemedText>
          <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            Your workout plan has been saved successfully
          </ThemedText>
          <View style={styles.successActions}>
            <GradientButton
              label="Start Workout"
              icon="play"
              onPress={() => {
                if (savedPlanId) navigation.navigate("StartWorkout", { planId: savedPlanId });
              }}
            />
            <OutlineButton
              label="View Plan"
              icon="list"
              onPress={() => {
                if (savedPlanId) navigation.navigate("PlanDetail", { planId: savedPlanId });
              }}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  // ── Selected ───────────────────────────────────────────────────────────────
  if (screenState === "selected") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing["2xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              Selected Photos ({images.length}/5)
            </ThemedText>
            <View style={styles.thumbnailGrid}>
              {images.map((img, i) => (
                <View key={i} style={styles.thumbnailWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.thumbnail} resizeMode="cover" />
                  <Pressable
                    onPress={() => handleRemoveImage(i)}
                    style={styles.removeButton}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Feather name="x" size={12} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>
          </Animated.View>

          {error && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.errorBox, { backgroundColor: Colors.light.error + "15", borderColor: Colors.light.error + "40" }]}
            >
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <ThemedText style={[styles.errorText, { color: Colors.light.error }]}>{error}</ThemedText>
            </Animated.View>
          )}

          {images.length < 5 && (
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.addMoreRow}>
              <OutlineButton label="Camera" icon="camera" onPress={() => handlePickImage("camera")} small />
              <OutlineButton label="Library" icon="image" onPress={() => handlePickImage("library")} small />
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.analyzeWrapper}>
            <GradientButton label="Analyze with AI" icon="zap" onPress={handleAnalyze} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (screenState === "preview" && previewPlan) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Plan Name</ThemedText>
            <TextInput
              style={[
                styles.planNameInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={planName}
              onChangeText={setPlanName}
              placeholder="Plan name"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
            />
          </Animated.View>

          {previewPlan.days.map((day, dayIdx) => (
            <Animated.View
              key={dayIdx}
              entering={FadeInDown.delay(100 + dayIdx * 60).duration(400)}
            >
              <Pressable
                onPress={() => toggleDay(dayIdx)}
                style={[styles.dayHeader, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
              >
                <View style={[styles.dayIconBox, { backgroundColor: Colors.light.primary + "15" }]}>
                  <Feather name="calendar" size={16} color={Colors.light.primary} />
                </View>
                <ThemedText style={styles.dayName}>{day.dayName}</ThemedText>
                <ThemedText style={[styles.exerciseCount, { color: theme.textSecondary }]}>
                  {day.exercises.length} exercises
                </ThemedText>
                <Feather
                  name={expandedDays.has(dayIdx) ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>

              {expandedDays.has(dayIdx) && (
                <View style={[styles.exerciseList, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  {day.exercises.map((ex, exIdx) => (
                    <View
                      key={exIdx}
                      style={[
                        styles.exerciseRow,
                        exIdx < day.exercises.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.exerciseInfo}>
                        <ThemedText style={styles.exerciseName}>{ex.name}</ThemedText>
                        <ThemedText style={[styles.exerciseMeta, { color: theme.textSecondary }]}>
                          {ex.sets} sets
                          {ex.reps !== null ? ` × ${ex.reps} reps` : ""}
                          {ex.weight !== null ? ` · ${ex.weight} kg` : ""}
                        </ThemedText>
                        {ex.notes ? (
                          <ThemedText style={[styles.exerciseNotes, { color: theme.textSecondary }]}>
                            {ex.notes}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>
          ))}

          {error && (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.errorBox, { backgroundColor: Colors.light.error + "15", borderColor: Colors.light.error + "40" }]}
            >
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <ThemedText style={[styles.errorText, { color: Colors.light.error }]}>{error}</ThemedText>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.previewActions}>
            <GradientButton label="Save Plan" icon="check" onPress={handleSavePlan} />
            <OutlineButton label="Try Again" icon="rotate-ccw" onPress={handleTryAgain} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  // Landing
  landingInner: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  landingTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  landingSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  pickButtonRow: {
    width: "100%",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  hintText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  // Loading
  loadingInner: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
  },
  // Success
  successInner: {
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  checkCircle: {
    width: 108,
    height: 108,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  successActions: {
    width: "100%",
    gap: Spacing.md,
  },
  // Selected / thumbnails
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  thumbnailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  thumbnailWrapper: {
    position: "relative",
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.md,
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.light.error,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  addMoreRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  analyzeWrapper: {},
  // Preview
  planNameInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dayIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dayName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  exerciseCount: {
    fontSize: 13,
  },
  exerciseList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    marginTop: -BorderRadius.md,
    paddingTop: BorderRadius.md,
    overflow: "hidden",
  },
  exerciseRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 2,
  },
  exerciseMeta: {
    fontSize: 13,
  },
  exerciseNotes: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: "italic",
  },
  previewActions: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  // Shared buttons
  gradientButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
  },
  gradientButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
  },
  outlineButtonSmall: {
    height: 40,
    paddingHorizontal: Spacing.lg,
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    color: Colors.light.primary,
  },
  outlineButtonTextSmall: {
    fontSize: 14,
  },
});
