/**
 * Integration tests for the subscription system.
 *
 * Covers:
 *  - GET /api/subscriptions/status — returns free by default
 *  - POST /api/subscriptions/validate/apple — returns 503 when SUBSCRIPTIONS_ENABLED=false
 *  - POST /api/subscriptions/validate/google — returns 503 when SUBSCRIPTIONS_ENABLED=false
 *  - subscriptionService helpers: markUserPro, getSubscriptionStatus, markUserFree
 *  - Expiry logic: an expired subscription is lazily demoted to free
 */
import { beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { initDb } from "../db";
import db from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";
import * as subscriptionService from "../services/subscriptionService";

// ── Bootstrap ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

let token = "";
let userId = 0;

beforeAll(async () => {
  initDb();
  registerRoutes(app);
  app.use(errorHandler);

  const res = await request(app).post("/api/auth/signup").send({
    username: "subuser",
    email: "sub@test.com",
    password: "testpass2",
  });
  token = res.body.token as string;
  userId = res.body.user.id as number;
});

// ── Status endpoint ────────────────────────────────────────────────────────
describe("GET /api/subscriptions/status", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/subscriptions/status");
    expect(res.status).toBe(401);
  });

  it("returns free tier for a new user", async () => {
    const res = await request(app)
      .get("/api/subscriptions/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe("free");
    expect(res.body.isPro).toBe(false);
    expect(res.body.provider).toBeNull();
    expect(res.body.expiresAt).toBeNull();
  });
});

// ── Validation endpoints (disabled by default) ─────────────────────────────
describe("POST /api/subscriptions/validate/apple — SUBSCRIPTIONS_ENABLED=false", () => {
  it("returns 503 when subscriptions are not enabled", async () => {
    const res = await request(app)
      .post("/api/subscriptions/validate/apple")
      .set("Authorization", `Bearer ${token}`)
      .send({ receiptData: "fake-receipt-data" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBeDefined();
  });
});

describe("POST /api/subscriptions/validate/google — SUBSCRIPTIONS_ENABLED=false", () => {
  it("returns 503 when subscriptions are not enabled", async () => {
    const res = await request(app)
      .post("/api/subscriptions/validate/google")
      .set("Authorization", `Bearer ${token}`)
      .send({ packageName: "com.app", subscriptionId: "pro_monthly", purchaseToken: "tok" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBeDefined();
  });
});

// ── Webhook endpoints (always accept) ─────────────────────────────────────
describe("POST /api/subscriptions/webhooks/apple", () => {
  it("returns 200 even with a garbage payload (always ack)", async () => {
    const res = await request(app)
      .post("/api/subscriptions/webhooks/apple")
      .send({ garbage: true });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/subscriptions/webhooks/google", () => {
  it("returns 200 even with a garbage payload", async () => {
    const res = await request(app)
      .post("/api/subscriptions/webhooks/google")
      .send({ garbage: true });
    expect(res.status).toBe(200);
  });
});

// ── subscriptionService unit tests ─────────────────────────────────────────
describe("subscriptionService.getSubscriptionStatus()", () => {
  it("returns free tier for a new user", () => {
    const status = subscriptionService.getSubscriptionStatus(userId);
    expect(status.tier).toBe("free");
    expect(status.isPro).toBe(false);
    expect(status.provider).toBeNull();
  });
});

describe("subscriptionService.markUserPro() + getSubscriptionStatus()", () => {
  it("marks a user as pro with apple provider", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscriptionService.markUserPro(userId, "apple", "txn-abc-123", futureDate, "com.app.pro_monthly");

    const status = subscriptionService.getSubscriptionStatus(userId);
    expect(status.tier).toBe("pro");
    expect(status.isPro).toBe(true);
    expect(status.provider).toBe("apple");
    expect(status.expiresAt).toBe(futureDate);
  });

  it("status endpoint now returns pro for that user", async () => {
    const res = await request(app)
      .get("/api/subscriptions/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe("pro");
    expect(res.body.isPro).toBe(true);
  });
});

describe("subscriptionService.markUserFree()", () => {
  it("revokes pro status", () => {
    subscriptionService.markUserFree(userId);
    const status = subscriptionService.getSubscriptionStatus(userId);
    expect(status.tier).toBe("free");
    expect(status.isPro).toBe(false);
    expect(status.provider).toBeNull();
  });
});

describe("subscriptionService — expired subscription", () => {
  it("lazily demotes an expired subscription to free on next status check", () => {
    // Mark user as pro with an expiry in the past
    const pastDate = new Date(Date.now() - 1000).toISOString();
    subscriptionService.markUserPro(userId, "google", "txn-expired-001", pastDate, "pro_monthly");

    // Verify it was written to the DB
    const rawRow = db
      .prepare("SELECT subscription_tier FROM users WHERE id = ?")
      .get(userId) as { subscription_tier: string };
    expect(rawRow.subscription_tier).toBe("pro");

    // Now call getSubscriptionStatus — it should detect expiry and demote
    const status = subscriptionService.getSubscriptionStatus(userId);
    expect(status.tier).toBe("free");
    expect(status.isPro).toBe(false);

    // Verify DB was updated
    const afterRow = db
      .prepare("SELECT subscription_tier FROM users WHERE id = ?")
      .get(userId) as { subscription_tier: string };
    expect(afterRow.subscription_tier).toBe("free");
  });
});

describe("subscriptionService.findUserByOriginalTransactionId()", () => {
  it("returns the user ID for a previously stored transaction", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscriptionService.markUserPro(userId, "apple", "txn-lookup-001", futureDate);

    const found = subscriptionService.findUserByOriginalTransactionId("txn-lookup-001", "apple");
    expect(found).toBe(userId);
  });

  it("returns null for an unknown transaction ID", () => {
    const found = subscriptionService.findUserByOriginalTransactionId("no-such-txn", "apple");
    expect(found).toBeNull();
  });
});

describe("subscriptionService.setReceiptStatus()", () => {
  it("marks a receipt as cancelled and demotes the user to free", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    subscriptionService.markUserPro(userId, "apple", "txn-cancel-001", futureDate);

    subscriptionService.setReceiptStatus(userId, "apple", "txn-cancel-001", "cancelled");

    const status = subscriptionService.getSubscriptionStatus(userId);
    expect(status.tier).toBe("free");

    const receipt = db
      .prepare("SELECT status FROM subscription_receipts WHERE original_transaction_id = ?")
      .get("txn-cancel-001") as { status: string } | undefined;
    expect(receipt?.status).toBe("cancelled");
  });
});
