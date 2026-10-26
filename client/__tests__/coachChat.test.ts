import { describe, it, expect, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@/lib/query-client", () => ({ getApiUrl: () => "http://x" }));

import { toWireMessages, type CoachChatMessage } from "@/lib/coachChat";

const msg = (i: number, role: "user" | "coach", text = `m${i}`): CoachChatMessage => ({
  id: String(i),
  role,
  text,
  createdAt: i,
});

describe("toWireMessages", () => {
  it("sends only role and text of the last 12 non-empty turns", () => {
    const history = Array.from({ length: 20 }, (_, i) => msg(i, i % 2 ? "coach" : "user"));
    history.push(msg(20, "coach", "  "));
    history.push({ ...msg(21, "coach", "offline"), local: true });
    const wire = toWireMessages(history);
    expect(wire).toHaveLength(12);
    expect(wire[0]).toEqual({ role: "user", text: "m8" });
    expect(wire[11]).toEqual({ role: "coach", text: "m19" });
  });
});
