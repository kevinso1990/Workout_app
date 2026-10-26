import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { Palette } from "@/constants/palettes";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  getUserPreferences,
  getWorkoutHistory,
  getWorkoutPlans,
  saveWorkoutPlan,
} from "@/lib/storage";
import { buildDailyBriefingPayload } from "@/lib/coachHelpers";
import { translateDayName } from "@/lib/dayNameLabel";
import { primaryPlan, todayOverview } from "@/lib/todayPlan";
import { recentRecords } from "@/lib/strengthProgress";
import { useCommitmentLabels } from "@/components/schedule/CommitmentEditor";
import {
  CoachLimitError,
  clearCoachChat,
  loadCoachChat,
  saveCoachChat,
  sendCoachMessage,
  type CoachChatMessage,
} from "@/lib/coachChat";
import { applyModifyResultToPlan, requestPlanModify } from "@/lib/planModifyApi";
import { scheduleDataSync } from "@/lib/dataSync";
import { confirmAlert } from "@/lib/confirmAlert";
import { toast } from "@/lib/toast";
import { paddingTopUnderHeader } from "@/lib/paddingTopUnderHeader";

type Route = RouteProp<RootStackParamList, "CoachChat">;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Chat with the coach. Every turn sends what the app knows about the athlete
 * (plan, recent sessions, records, week) so answers are about *their*
 * training; plan changes come back as a preview to confirm, never applied
 * silently.
 */
export default function CoachChatScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { dayLabel, sportLabel } = useCommitmentLabels();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<CoachChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const locale: "de" | "en" = i18n.language.startsWith("de") ? "de" : "en";

  // Persist on every change; the list is small.
  const update = useCallback((fn: (prev: CoachChatMessage[]) => CoachChatMessage[]) => {
    setMessages((prev) => {
      const next = fn(prev ?? []);
      void saveCoachChat(next);
      return next;
    });
  }, []);

  useEffect(() => {
    void loadCoachChat().then((loaded) => {
      const seed = route.params?.seed?.trim();
      // Opened from the daily tip: that tip is the coach's opening line, so
      // "Antworten" really is replying to it.
      if (seed && loaded[loaded.length - 1]?.text !== seed) {
        const next = [...loaded, { id: newId(), role: "coach" as const, text: seed, createdAt: Date.now() }];
        void saveCoachChat(next);
        setMessages(next);
      } else {
        setMessages(loaded);
      }
    });
  }, [route.params?.seed]);

  const clearChat = useCallback(async () => {
    const ok = await confirmAlert(t("coachChat.clearTitle"), t("coachChat.clearMessage"), {
      confirmText: t("coachChat.clear"),
      cancelText: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    await clearCoachChat();
    setMessages([]);
  }, [t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        messages && messages.length > 0 ? (
          <Pressable
            onPress={() => void clearChat()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("coachChat.clear")}
            testID="button-coach-clear"
          >
            <Feather name="rotate-ccw" size={20} color={theme.text} />
          </Pressable>
        ) : null,
    });
  }, [navigation, messages, clearChat, t, theme.text]);

  /** Everything the coach should know, as plain text. Rebuilt per message so it's never stale. */
  const buildContext = useCallback(async (): Promise<string> => {
    const [plans, history, prefs] = await Promise.all([
      getWorkoutPlans(),
      getWorkoutHistory(),
      getUserPreferences(),
    ]);
    const payload = buildDailyBriefingPayload(plans, history, i18n.language, (n) => translateDayName(t, n));
    const commitments = prefs?.weeklyCommitments ?? [];
    const mobilityDays = prefs?.mobilityWeekdays ?? [];
    const today = todayOverview({
      plans,
      commitments,
      mobilityWeekdays: mobilityDays,
      history,
      now: new Date(),
    });
    const records = recentRecords(history, new Date());
    const lines = [
      `Today: ${new Date().toISOString().slice(0, 10)} (${dayLabel((new Date().getDay() + 6) % 7)})`,
      today.strength
        ? `Scheduled today: ${translateDayName(t, today.strength.dayName)}`
        : today.next
          ? `Rest day today; next: ${translateDayName(t, today.next.dayName)} on ${dayLabel(today.next.weekday)}`
          : "",
      prefs?.fitnessLevel ? `Level: ${prefs.fitnessLevel}` : "",
      prefs?.fitnessGoals?.length ? `Goals: ${prefs.fitnessGoals.join(", ")}` : "",
      prefs?.equipment ? `Equipment: ${prefs.equipment}` : "",
      prefs?.avoidExercises?.length ? `Avoids: ${prefs.avoidExercises.join(", ")}` : "",
      commitments.length
        ? `Fixed sport: ${commitments.map((c) => `${sportLabel(c)} ${dayLabel(c.weekday)}`).join(", ")}`
        : "",
      mobilityDays.length ? `Mobility days: ${mobilityDays.map(dayLabel).join(", ")}` : "",
      `Main plan: ${primaryPlan(plans)?.name ?? "none"}`,
      "",
      payload.planSummary,
      "",
      "Recent sessions:",
      payload.sessionSummary || "(none)",
      records.length
        ? `New records (30 days): ${records.map((r) => `${r.exerciseName} ${r.weight}kg×${r.reps}`).join(", ")}`
        : "",
      payload.performanceDetail ? `Best recent sets:\n${payload.performanceDetail}` : "",
      payload.signalsText,
    ];
    return lines.filter((l) => l !== undefined).join("\n").slice(0, 9500);
  }, [i18n.language, t, dayLabel, sportLabel]);

  const prepareProposal = useCallback(
    async (messageId: string, instruction: string) => {
      const plans = await getWorkoutPlans();
      const plan = primaryPlan(plans);
      if (!plan) {
        update((prev) =>
          prev.map((m) =>
            m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status: "failed" } } : m,
          ),
        );
        return;
      }
      try {
        const result = await requestPlanModify(plan, instruction);
        update((prev) =>
          prev.map((m) =>
            m.id === messageId && m.proposal
              ? { ...m, proposal: { ...m.proposal, planId: plan.id, status: "ready", result } }
              : m,
          ),
        );
      } catch {
        update((prev) =>
          prev.map((m) =>
            m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, status: "failed" } } : m,
          ),
        );
      }
    },
    [update],
  );

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? draft).trim();
      if (!text || sending || !messages) return;
      Haptics.selectionAsync();
      setDraft("");
      setSending(true);
      const userMsg: CoachChatMessage = { id: newId(), role: "user", text, createdAt: Date.now() };
      const withUser = [...messages, userMsg];
      update(() => withUser);
      try {
        const context = await buildContext();
        const { reply, planChange } = await sendCoachMessage({ locale, context, messages: withUser });
        const plans = await getWorkoutPlans();
        const coachMsg: CoachChatMessage = {
          id: newId(),
          role: "coach",
          text: reply,
          createdAt: Date.now(),
          proposal: planChange
            ? { instruction: planChange, planId: primaryPlan(plans)?.id ?? "", status: "loading" }
            : undefined,
        };
        update((prev) => [...prev, coachMsg]);
        if (planChange) void prepareProposal(coachMsg.id, planChange);
      } catch (err) {
        const limit = err instanceof CoachLimitError;
        update((prev) => [
          ...prev,
          {
            id: newId(),
            role: "coach",
            text: t(limit ? "coachChat.limitReached" : "coachChat.error"),
            createdAt: Date.now(),
            local: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [draft, sending, messages, update, buildContext, locale, prepareProposal, t],
  );

  const applyProposal = useCallback(
    async (message: CoachChatMessage) => {
      const p = message.proposal;
      if (!p?.result) return;
      const plans = await getWorkoutPlans();
      const plan = plans.find((x) => x.id === p.planId);
      if (!plan) {
        toast.error(t("plans.planNotFound"));
        return;
      }
      try {
        await saveWorkoutPlan(applyModifyResultToPlan(plan, p.result));
        scheduleDataSync();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        update((prev) =>
          prev.map((m) => (m.id === message.id && m.proposal ? { ...m, proposal: { ...m.proposal, status: "applied" } } : m)),
        );
        toast.success(t("coachChat.applied"));
      } catch {
        toast.error(t("common.saveFailed"));
      }
    },
    [update, t],
  );

  const dismissProposal = useCallback(
    (message: CoachChatMessage) => {
      update((prev) =>
        prev.map((m) => (m.id === message.id && m.proposal ? { ...m, proposal: { ...m.proposal, status: "dismissed" } } : m)),
      );
    },
    [update],
  );

  const suggestions = [
    t("coachChat.suggestion1"),
    t("coachChat.suggestion2"),
    t("coachChat.suggestion3"),
    t("coachChat.suggestion4"),
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      // The screen already extends under the transparent header.
      keyboardVerticalOffset={0}
    >
      <ScrollView
        ref={scrollRef}
        // The stack header is transparent; content starts below it.
        contentContainerStyle={[
          styles.list,
          { paddingTop: paddingTopUnderHeader(headerHeight, insets.top, Spacing.lg) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages && messages.length === 0 ? (
          <View style={styles.empty} testID="coach-chat-empty">
            <View style={[styles.emptyIcon, { backgroundColor: theme.ironElevated2 }]}>
              <Feather name="message-circle" size={26} color={theme.text} />
            </View>
            <ThemedText style={styles.emptyTitle}>{t("coachChat.emptyTitle")}</ThemedText>
            <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
              {t("coachChat.emptyBody")}
            </ThemedText>
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => void send(s)}
                  style={[styles.suggestion, { borderColor: theme.controlOutline }]}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.suggestionText}>{s}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {(messages ?? []).map((m) => (
          <View key={m.id} style={m.role === "user" ? styles.rowUser : styles.rowCoach}>
            <View
              style={[
                styles.bubble,
                m.role === "user"
                  ? [styles.bubbleUser, { backgroundColor: theme.primary }]
                  : [styles.bubbleCoach, { backgroundColor: theme.ironElevated2 }],
              ]}
            >
              <ThemedText
                style={[styles.bubbleText, { color: m.role === "user" ? theme.onChalk : theme.text }]}
                selectable
              >
                {m.text}
              </ThemedText>
            </View>
            {m.proposal ? (
              <ProposalCard
                message={m}
                styles={styles}
                theme={theme}
                onApply={() => void applyProposal(m)}
                onDismiss={() => dismissProposal(m)}
              />
            ) : null}
          </View>
        ))}

        {sending ? (
          <View style={styles.rowCoach}>
            <View style={[styles.bubble, styles.bubbleCoach, { backgroundColor: theme.ironElevated2 }]}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { borderTopColor: theme.hairline, paddingBottom: Math.max(insets.bottom, Spacing.md) },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t("coachChat.placeholder")}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.ironElevated2 }]}
          multiline
          maxLength={1000}
          testID="input-coach-message"
        />
        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim() || sending}
          style={[
            styles.sendBtn,
            { backgroundColor: theme.primary, opacity: !draft.trim() || sending ? 0.4 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("coachChat.send")}
          testID="button-coach-send"
        >
          <Feather name="arrow-up" size={20} color={theme.onChalk} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ProposalCard({
  message,
  styles,
  theme,
  onApply,
  onDismiss,
}: {
  message: CoachChatMessage;
  styles: ReturnType<typeof makeStyles>;
  theme: Palette;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const p = message.proposal!;
  return (
    <View style={[styles.proposal, { borderColor: theme.controlOutline }]} testID="card-coach-proposal">
      <View style={styles.proposalHeader}>
        <Feather name="edit-3" size={14} color={theme.text} />
        <ThemedText style={styles.proposalTitle}>{t("coachChat.proposalTitle")}</ThemedText>
      </View>
      {p.status === "loading" ? (
        <View style={styles.proposalLoading}>
          <ActivityIndicator size="small" color={theme.textSecondary} />
          <ThemedText style={[styles.proposalMeta, { color: theme.textSecondary }]}>
            {t("coachChat.proposalLoading")}
          </ThemedText>
        </View>
      ) : p.status === "failed" ? (
        <ThemedText style={[styles.proposalMeta, { color: theme.textSecondary }]}>
          {t("coachChat.proposalFailed")}
        </ThemedText>
      ) : (
        <>
          {p.result?.summary ? <ThemedText style={styles.proposalSummary}>{p.result.summary}</ThemedText> : null}
          {(p.result?.changes ?? []).slice(0, 5).map((c) => (
            <ThemedText key={c} style={[styles.proposalMeta, { color: theme.textSecondary }]}>
              • {c}
            </ThemedText>
          ))}
          {p.status === "ready" ? (
            <View style={styles.proposalActions}>
              <Pressable
                onPress={onDismiss}
                style={[styles.proposalBtn, { borderWidth: 1, borderColor: theme.controlOutline }]}
                accessibilityRole="button"
              >
                <ThemedText style={styles.proposalBtnText}>{t("coachChat.dismiss")}</ThemedText>
              </Pressable>
              <Pressable
                onPress={onApply}
                style={[styles.proposalBtn, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                testID="button-coach-apply"
              >
                <ThemedText style={[styles.proposalBtnText, { color: theme.onChalk }]}>
                  {t("coachChat.apply")}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={[styles.proposalMeta, { color: theme.textSecondary }]}>
              {p.status === "applied" ? `✓ ${t("coachChat.applied")}` : t("coachChat.dismissed")}
            </ThemedText>
          )}
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    screen: { flex: 1 },
    list: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    empty: {
      alignItems: "center",
      paddingTop: Spacing["2xl"],
      paddingHorizontal: Spacing.lg,
      gap: Spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.sm,
    },
    emptyTitle: { fontSize: 20, fontWeight: "700" },
    emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
    suggestions: {
      marginTop: Spacing.lg,
      alignSelf: "stretch",
      gap: Spacing.sm,
    },
    suggestion: {
      borderWidth: 1,
      borderRadius: BorderRadius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    suggestionText: { fontSize: 14 },
    rowUser: { alignItems: "flex-end" },
    rowCoach: { alignItems: "flex-start", gap: Spacing.sm },
    bubble: {
      maxWidth: "85%",
      paddingVertical: Spacing.sm + 2,
      paddingHorizontal: Spacing.md + 2,
      borderRadius: 18,
    },
    bubbleUser: { borderBottomRightRadius: 6 },
    bubbleCoach: { borderBottomLeftRadius: 6 },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    proposal: {
      width: "85%",
      borderWidth: 1,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: 6,
    },
    proposalHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    proposalTitle: { fontSize: 13, fontWeight: "700" },
    proposalLoading: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    proposalSummary: { fontSize: 14, lineHeight: 20 },
    proposalMeta: { fontSize: 13, lineHeight: 18 },
    proposalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs },
    proposalBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: Spacing.sm + 2,
      borderRadius: BorderRadius.full,
    },
    proposalBtnText: { fontSize: 14, fontWeight: "700" },
    inputBar: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: c.backgroundRoot,
    },
    input: {
      flex: 1,
      minHeight: 42,
      maxHeight: 120,
      borderRadius: 21,
      paddingHorizontal: Spacing.lg,
      paddingTop: 11,
      paddingBottom: 11,
      fontSize: 15,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
  });
