import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";
import { IMPORT_JSON_HEADERS } from "@/lib/importApiHeaders";
import type { PlanModifyResponse } from "@/lib/planModifyApi";

export type CoachProposalStatus = "loading" | "ready" | "applied" | "dismissed" | "failed";

export interface CoachChatMessage {
  id: string;
  role: "user" | "coach";
  text: string;
  createdAt: number;
  /** App-generated notice (offline, daily limit) — shown, never sent to the coach. */
  local?: boolean;
  /** A plan change the coach offered with this reply. */
  proposal?: {
    instruction: string;
    planId: string;
    status: CoachProposalStatus;
    result?: PlanModifyResponse;
  };
}

const STORAGE_KEY = "@coachChat";
/** Enough scrollback to be useful; older turns are dropped on save. */
const MAX_STORED = 60;
/** Turns sent with each request — the server trims to the same window. */
const MAX_SENT = 12;
const REQUEST_TIMEOUT_MS = 45_000;

export async function loadCoachChat(): Promise<CoachChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CoachChatMessage[]) : [];
    // A proposal still "loading" when the app closed will never finish.
    return parsed.map((m) =>
      m.proposal?.status === "loading" ? { ...m, proposal: { ...m.proposal, status: "failed" } } : m,
    );
  } catch {
    return [];
  }
}

export async function saveCoachChat(messages: CoachChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {
    // non-fatal: the chat just won't survive a restart
  }
}

export async function clearCoachChat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class CoachLimitError extends Error {}

/** Wire format: only role + text, newest last, the athlete's turn at the end. */
export function toWireMessages(messages: CoachChatMessage[]): { role: "user" | "coach"; text: string }[] {
  return messages
    .filter((m) => !m.local && m.text.trim().length > 0)
    .slice(-MAX_SENT)
    .map((m) => ({ role: m.role, text: m.text }));
}

export async function sendCoachMessage(input: {
  locale: "de" | "en";
  context: string;
  messages: CoachChatMessage[];
}): Promise<{ reply: string; planChange: string | null }> {
  const url = new URL("/api/coach/chat", getApiUrl()).toString();
  // The server retries AI providers for up to ~50s; don't leave the athlete
  // staring at a spinner longer than that.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...IMPORT_JSON_HEADERS },
      body: JSON.stringify({
        locale: input.locale,
        context: input.context,
        messages: toWireMessages(input.messages),
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new CoachLimitError("daily limit");
  const data = (await res.json().catch(() => null)) as
    | { reply?: string; planChange?: string | null; error?: string }
    | null;
  if (!res.ok || !data?.reply) {
    throw new Error(data?.error ?? `Coach failed (${res.status})`);
  }
  return { reply: data.reply, planChange: data.planChange ?? null };
}
