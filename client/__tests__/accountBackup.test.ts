import { describe, expect, it } from "vitest";
import { afterSignInAction } from "../lib/accountBackup";

const c = (historyCount: number, planCount: number) => ({ historyCount, planCount });

describe("afterSignInAction", () => {
  it("uploads when the account has no backup", () => {
    expect(afterSignInAction(c(12, 2), null)).toBe("upload");
    expect(afterSignInAction(c(12, 2), c(0, 0))).toBe("upload");
  });
  it("restores onto an empty phone", () => {
    expect(afterSignInAction(c(0, 0), c(30, 3))).toBe("restore");
  });
  it("restores over a fresh plan with no logged workouts", () => {
    expect(afterSignInAction(c(0, 1), c(30, 3))).toBe("restore");
  });
  it("asks when both sides have workouts", () => {
    expect(afterSignInAction(c(4, 1), c(30, 3))).toBe("ask");
  });
  it("asks when only plans exist on both sides", () => {
    expect(afterSignInAction(c(0, 1), c(0, 2))).toBe("ask");
  });
});
