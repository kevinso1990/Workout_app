import { describe, it, expect } from "vitest";

import { formatElapsed } from "@/lib/elapsedLabel";

const t = (key: string, opts?: Record<string, unknown>) => `${opts?.count} ${key.split(".").pop()}`;
const MIN = 60_000;

describe("formatElapsed", () => {
  const now = 1_000_000_000_000;

  it("shows minutes under an hour, never 0", () => {
    expect(formatElapsed(t, now - 10_000, now)).toBe("1 minutes");
    expect(formatElapsed(t, now - 42 * MIN, now)).toBe("42 minutes");
  });

  it("switches to hours, then days", () => {
    expect(formatElapsed(t, now - 3 * 60 * MIN, now)).toBe("3 hours");
    expect(formatElapsed(t, now - 50 * 60 * MIN, now)).toBe("2 days");
  });
});
