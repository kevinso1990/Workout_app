import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  FadeInDown,
  FadeIn,
  Easing,
  interpolate,
  cancelAnimation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  useWorkoutImport,
  ImportedWorkoutPlan,
  ImportedExercise,
  PickedImage,
  PickedFile,
  openAppSettings,
  WorkoutImportUnreadableError,
  formatImportFailure,
} from "@/hooks/useWorkoutImport";
import { getApiUrl } from "@/lib/query-client";
import { ImportPlanReviewPanel } from "@/components/import/ImportPlanReviewPanel";
import type { CatalogRow as ImportCatalogRow } from "@/lib/importCatalog";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ScreenState = "landing" | "selected" | "loading" | "review" | "manual" | "success";

type CatalogRow = ImportCatalogRow;

type CatalogPickTarget =
  | null
  | { kind: "add"; dayIdx: number };

function countImportedExercises(plan: ImportedWorkoutPlan | null): number {
  if (!plan?.days) return 0;
  return plan.days.reduce((sum, d) => sum + d.exercises.length, 0);
}

function emptyManualPlan(planName: string): ImportedWorkoutPlan {
  return {
    planName: planName?.trim() || "Mein Plan",
    days: [{ dayName: "Tag 1", exercises: [] }],
  };
}

const MSG_IMPORT_UNREADABLE_DE =
  "Entschuldigung, ich konnte die Übungen nicht klar lesen. Bitte versuche ein schärferes Foto, mehr Licht oder einen kürzeren Abstand zum Text.";

function ScanningView({
  imageUri,
  title,
  subtitle,
}: {
  imageUri: string | null;
  title: string;
  subtitle: string;
}) {
  const { theme } = useTheme();
  const frameH = useSharedValue(240);
  const scan = useSharedValue(0);

  useEffect(() => {
    scan.value = 0;
    scan.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan is a Reanimated shared value
  }, [imageUri]);

  const laserStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    transform: [
      {
        translateY: interpolate(scan.value, [0, 1], [0, Math.max(0, frameH.value - 4)]),
      },
    ],
    shadowColor: "#00E5FF",
    shadowOpacity: 0.95,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  }));

  return (
    <View style={styles.scanRoot}>
      <ThemedText style={[styles.scanTitle, { color: theme.text }]}>{title}</ThemedText>
      <ThemedText style={[styles.scanSubtitle, { color: theme.textSecondary }]}>{subtitle}</ThemedText>

      <View
        style={[styles.scanFrame, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
        onLayout={(e) => {
          frameH.value = e.nativeEvent.layout.height;
        }}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.scanImage} resizeMode="cover" />
        ) : (
          <View style={[styles.scanPlaceholder, { backgroundColor: theme.backgroundRoot }]}>
            <Feather name="file-text" size={44} color={Colors.light.primary} />
            <ThemedText style={[styles.scanPlaceholderText, { color: theme.textSecondary }]}>
              Dokument wird analysiert…
            </ThemedText>
          </View>
        )}
        <Animated.View style={laserStyle} pointerEvents="none">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.light.primary }]} />
        </Animated.View>
      </View>

      <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginTop: Spacing.lg }} />
    </View>
  );
}

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
      <View style={[styles.gradientButton, { backgroundColor: Colors.light.primary }]}>
        <Feather name={icon} size={18} color="#FFFFFF" />
        <ThemedText style={styles.gradientButtonText}>{label}</ThemedText>
      </View>
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

function CatalogPickModal({
  visible,
  title,
  rows,
  loading,
  query,
  onQueryChange,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  rows: CatalogRow[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (row: CatalogRow) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.muscle_group.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[catalogModalStyles.root, { backgroundColor: theme.backgroundRoot }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[catalogModalStyles.header, { borderBottomColor: theme.border }]}>
          <ThemedText style={catalogModalStyles.headerTitle}>{title}</ThemedText>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={[catalogModalStyles.searchWrap, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[catalogModalStyles.searchInput, { color: theme.text }]}
            placeholder="Übung suchen…"
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={onQueryChange}
            autoCorrect={false}
          />
        </View>
        {loading ? (
          <View style={catalogModalStyles.center}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(item);
                }}
                style={({ pressed }) => [
                  catalogModalStyles.row,
                  { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={catalogModalStyles.rowName}>{item.name}</ThemedText>
                  <ThemedText style={[catalogModalStyles.rowSub, { color: theme.textSecondary }]}>
                    {item.muscle_group}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            )}
            ListEmptyComponent={
              <ThemedText style={[catalogModalStyles.empty, { color: theme.textSecondary }]}>
                Keine Treffer
              </ThemedText>
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const catalogModalStyles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Montserrat_700Bold", flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, paddingVertical: Platform.OS === "ios" ? 12 : 8, fontSize: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  rowName: { fontSize: 16, fontWeight: "600", fontFamily: "Montserrat_600SemiBold" },
  rowSub: { fontSize: 13, marginTop: 2 },
  empty: { textAlign: "center", padding: Spacing["2xl"], fontSize: 15 },
});

export default function ImportWorkoutScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { pickImage, pickFile, analyzeImages, analyzeFile, saveImportedPlan } = useWorkoutImport();

  const [screenState, setScreenState] = useState<ScreenState>("landing");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [loadingText, setLoadingText] = useState("Reading your workout plan...");
  const [previewPlan, setPreviewPlan] = useState<ImportedWorkoutPlan | null>(null);
  const [planName, setPlanName] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorNeedsSettings, setErrorNeedsSettings] = useState(false);
  /** First image URI while AI runs (laser scan); null for PDF/spreadsheet. */
  const [loadingScanUri, setLoadingScanUri] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogPick, setCatalogPick] = useState<CatalogPickTarget>(null);
  const [importSummaryText, setImportSummaryText] = useState<string | null>(null);

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

  useEffect(() => {
    if (screenState !== "review" && screenState !== "manual") return;
    let cancelled = false;
    setCatalogLoading(true);
    (async () => {
      try {
        const url = new URL("/api/exercises/catalog", getApiUrl()).toString();
        const res = await fetch(url);
        if (!res.ok) throw new Error("catalog");
        const rows = (await res.json()) as CatalogRow[];
        if (!cancelled) setCatalog(rows);
      } catch {
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenState]);

  const setErrorWithSettings = (msg: string) => {
    const needsSettings = msg.toLowerCase().includes("settings");
    setError(msg);
    setErrorNeedsSettings(needsSettings);
  };

  const presentImportFailure = useCallback((e: unknown, fallback: string) => {
    const detail = formatImportFailure(e, fallback);
    setErrorWithSettings(detail);
    Alert.alert("Import failed", detail);
    console.error("[ImportWorkoutScreen]", detail, e);
  }, []);

  const handlePickImage = async (source: "camera" | "library") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const picked = await pickImage(source);
      if (!picked) return;
      const next = [...images, picked];
      setImages(next);
      setPickedFile(null);
      setScreenState("selected");
      setError(null);
      setErrorNeedsSettings(false);
    } catch (e: unknown) {
      setErrorWithSettings(e instanceof Error ? e.message : "Could not access photos.");
    }
  };

  // PDF / Excel / CSV — files don't stack like photos, so picking a file goes
  // straight to the analyze step (replacing any previously picked file).
  const handlePickFile = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const file = await pickFile();
      if (!file) {
        setErrorWithSettings("That file type isn't supported yet — try a PDF, Excel, or CSV.");
        return;
      }
      setPickedFile(file);
      setImages([]);
      setError(null);
      setErrorNeedsSettings(false);
      // Drop straight into the loading state — single file means there's
      // nothing to multi-select / preview before analysis.
      runAnalyze({ file });
    } catch (e: unknown) {
      setErrorWithSettings(e instanceof Error ? e.message : "Could not open that file.");
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    if (next.length === 0) setScreenState("landing");
  };

  // Single analyze entry point for both image batches and individual files —
  // keeps the preview/error/loading state machine identical regardless of
  // which source the user picked.
  const runAnalyze = async (input: { images?: PickedImage[]; file?: PickedFile }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingScanUri(input.file ? null : input.images?.[0]?.uri ?? null);
    setScreenState("loading");
    setLoadingText("Reading your workout plan...");
    setError(null);
    setErrorNeedsSettings(false);
    loadingTimer.current = setTimeout(() => setLoadingText("Almost done..."), 2000);

    try {
      const planRaw = input.file
        ? await analyzeFile(input.file)
        : await analyzeImages(input.images ?? []);
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      setLoadingScanUri(null);
      const plan = planRaw as ImportedWorkoutPlan & { emptyPlan?: boolean };
      setPlanName(plan.planName || "Imported Plan");
      setExpandedDays(new Set([0]));
      setImportSummaryText(null);
      setError(null);
      setErrorNeedsSettings(false);
      const total = countImportedExercises(plan);
      if (plan.emptyPlan || total === 0) {
        setPreviewPlan(emptyManualPlan(plan.planName || "Mein Plan"));
        setScreenState("manual");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setPreviewPlan(plan);
        setScreenState("review");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: unknown) {
      if (loadingTimer.current) clearTimeout(loadingTimer.current);
      setLoadingScanUri(null);
      if (e instanceof WorkoutImportUnreadableError) {
        setErrorWithSettings(MSG_IMPORT_UNREADABLE_DE);
        Alert.alert("Import failed", MSG_IMPORT_UNREADABLE_DE);
      } else {
        presentImportFailure(
          e,
          "Could not read the plan. Try a clearer photo or better lighting.",
        );
      }
      setScreenState(input.file ? "landing" : "selected");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleAnalyze = () => {
    if (images.length === 0) return;
    runAnalyze({ images });
  };

  const handleSavePlan = async () => {
    if (!previewPlan) return;
    const total = countImportedExercises(previewPlan);
    if (total === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setErrorWithSettings("Füge mindestens eine Übung hinzu, bevor du speicherst.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    setErrorNeedsSettings(false);
    try {
      await saveImportedPlan({ ...previewPlan, planName: planName.trim() || previewPlan.planName });
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "Main",
              state: { routes: [{ name: "MyPlans" }], index: 0 },
            },
          ],
        }),
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setErrorWithSettings("Speichern fehlgeschlagen. Bitte versuche es erneut.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const resetImportFlow = useCallback(() => {
    setScreenState("landing");
    setImages([]);
    setPickedFile(null);
    setPreviewPlan(null);
    setPlanName("");
    setError(null);
    setErrorNeedsSettings(false);
    setCatalogPick(null);
    setCatalogQuery("");
    setImportSummaryText(null);
    setSavedPlanId(null);
  }, []);

  const appendCatalogExerciseToDay = useCallback((dayIdx: number, row: CatalogRow) => {
    setPreviewPlan((prev) => {
      if (!prev?.days?.[dayIdx]) return prev;
      const ex: ImportedExercise = {
        name: row.name,
        sets: 3,
        reps: 10,
        weight: null,
        notes: null,
        muscleGroup: row.muscle_group,
        catalogExerciseId: row.id,
        importMeta: {
          originalName: row.name,
          matchQuality: "exact",
          needsUserMapping: false,
        },
      };
      return {
        ...prev,
        days: prev.days.map((d, i) =>
          i === dayIdx ? { ...d, exercises: [...d.exercises, ex] } : d,
        ),
      };
    });
    setCatalogPick(null);
    setCatalogQuery("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const removeExerciseAt = useCallback((dayIdx: number, exIdx: number) => {
    setPreviewPlan((prev) => {
      if (!prev?.days?.[dayIdx]) return prev;
      return {
        ...prev,
        days: prev.days.map((d, i) =>
          i === dayIdx
            ? { ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) }
            : d,
        ),
      };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateImportedExercise = (
    dayIdx: number,
    exIdx: number,
    patch: Partial<ImportedExercise>,
  ) => {
    setPreviewPlan((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d, di) => {
        if (di !== dayIdx) return d;
        return {
          ...d,
          exercises: d.exercises.map((ex, ei) => (ei === exIdx ? { ...ex, ...patch } : ex)),
        };
      });
      return { ...prev, days };
    });
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
        <View style={[styles.centeredContent, { paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing["2xl"]) }]}>
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
            <OutlineButton label="Pick PDF / Excel / CSV" icon="file-text" onPress={handlePickFile} />
          </Animated.View>

          {error ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.errorBox, { backgroundColor: Colors.light.error + "15", borderColor: Colors.light.error + "40", marginBottom: Spacing.md }]}
            >
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.errorText, { color: Colors.light.error }]}>{error}</ThemedText>
                {errorNeedsSettings ? (
                  <Pressable onPress={openAppSettings} style={styles.settingsLink}>
                    <Feather name="settings" size={13} color={Colors.light.primary} />
                    <ThemedText style={[styles.settingsLinkText, { color: Colors.light.primary }]}>
                      Open Settings
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <ThemedText style={[styles.hintText, { color: theme.textSecondary }]}>
              Works with handwritten plans, screenshots, PDFs, Excel/CSV exports — anything
            </ThemedText>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ── Loading (scan laser on first photo when importing images) ─────────────
  if (screenState === "loading") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scanScrollContent,
            { paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.lg), paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(320)}>
            <ScanningView
              imageUri={loadingScanUri}
              title="KI-Scan"
              subtitle={loadingText}
            />
          </Animated.View>
        </ScrollView>
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
          <ThemedText style={styles.successTitle}>Import erfolgreich</ThemedText>
          <ThemedText style={[styles.successSubtitle, { color: theme.textSecondary }]}>
            {importSummaryText ?? "Dein Trainingsplan wurde gespeichert."}
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
            { paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl), paddingBottom: insets.bottom + Spacing["2xl"] },
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

          {error ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.errorBox, { backgroundColor: Colors.light.error + "15", borderColor: Colors.light.error + "40" }]}
            >
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.errorText, { color: Colors.light.error }]}>{error}</ThemedText>
                {errorNeedsSettings ? (
                  <Pressable onPress={openAppSettings} style={styles.settingsLink}>
                    <Feather name="settings" size={13} color={Colors.light.primary} />
                    <ThemedText style={[styles.settingsLinkText, { color: Colors.light.primary }]}>
                      Open Settings
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
          ) : null}

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

  // ── Review & correct (after AI parse) ───────────────────────────────────────
  if (screenState === "review" && previewPlan) {
    return (
      <>
        <ImportPlanReviewPanel
          plan={previewPlan}
          planName={planName}
          onPlanNameChange={setPlanName}
          catalog={catalog}
          catalogLoading={catalogLoading}
          headerPaddingTop={paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl)}
          onUpdateExercise={updateImportedExercise}
          onRemoveExercise={removeExerciseAt}
          onAddExercise={(dayIdx) => {
            setCatalogQuery("");
            setCatalogPick({ kind: "add", dayIdx });
          }}
          onSave={handleSavePlan}
          onCancel={resetImportFlow}
        />
        {error ? (
          <View
            style={{
              position: "absolute",
              left: Spacing.xl,
              right: Spacing.xl,
              bottom: 120,
              padding: Spacing.md,
              borderRadius: BorderRadius.md,
              backgroundColor: Colors.light.error + "15",
              borderWidth: 1,
              borderColor: Colors.light.error + "40",
            }}
          >
            <ThemedText style={{ color: Colors.light.error, fontSize: 14 }}>{error}</ThemedText>
          </View>
        ) : null}
        <CatalogPickModal
          visible={catalogPick !== null && catalogPick.kind === "add"}
          title={t("importWorkout.review.addExercise")}
          rows={catalog}
          loading={catalogLoading}
          query={catalogQuery}
          onQueryChange={setCatalogQuery}
          onSelect={(row) => {
            if (catalogPick?.kind !== "add") return;
            appendCatalogExerciseToDay(catalogPick.dayIdx, row);
            setError(null);
            setErrorNeedsSettings(false);
          }}
          onClose={() => {
            setCatalogPick(null);
            setCatalogQuery("");
          }}
        />
      </>
    );
  }

  // ── Manual build (KI empty) ─────────────────────────────────────────────────
  if (screenState === "manual" && previewPlan) {
    return (
      <>
        <ImportPlanReviewPanel
          plan={previewPlan}
          planName={planName}
          onPlanNameChange={setPlanName}
          catalog={catalog}
          catalogLoading={catalogLoading}
          headerPaddingTop={paddingTopUnderHeader(headerHeight, insets.top, Spacing.xl)}
          introHint={t("importWorkout.review.manualIntro")}
          onUpdateExercise={updateImportedExercise}
          onRemoveExercise={removeExerciseAt}
          onAddExercise={(dayIdx) => {
            setCatalogQuery("");
            setCatalogPick({ kind: "add", dayIdx });
          }}
          onSave={handleSavePlan}
          onCancel={resetImportFlow}
        />
        <CatalogPickModal
          visible={catalogPick !== null && catalogPick.kind === "add"}
          title={t("importWorkout.review.addExercise")}
          rows={catalog}
          loading={catalogLoading}
          query={catalogQuery}
          onQueryChange={setCatalogQuery}
          onSelect={(row) => {
            if (catalogPick?.kind !== "add") return;
            appendCatalogExerciseToDay(catalogPick.dayIdx, row);
          }}
          onClose={() => {
            setCatalogPick(null);
            setCatalogQuery("");
          }}
        />
      </>
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
  scanScrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  scanRoot: {
    alignItems: "center",
    width: "100%",
  },
  scanTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.xs,
  },
  scanSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  scanFrame: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  scanImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  scanPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  scanPlaceholderText: {
    fontSize: 14,
    textAlign: "center",
  },
  reviewHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  validationTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Montserrat_700Bold",
    marginBottom: Spacing.sm,
  },
  validationIntro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  daySectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  validationRow: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  validationRowNeedsMap: {
    borderColor: Colors.light.error,
    borderWidth: 1.5,
    backgroundColor: Colors.light.error + "08",
  },
  validationExerciseName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  validationOriginal: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: "italic",
  },
  validationMeta: {
    fontSize: 13,
    marginTop: 6,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    alignSelf: "flex-start",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  manualList: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  manualRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
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
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  settingsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.xs,
  },
  settingsLinkText: {
    fontSize: 13,
    fontWeight: "600",
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
    paddingVertical: Spacing.md,
  },
  exerciseEditBlock: {
    flex: 1,
    gap: Spacing.sm,
  },
  exerciseNameInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
  },
  importMetaLine: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: "italic",
  },
  exerciseMetricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
  miniFieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Montserrat_600SemiBold",
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
