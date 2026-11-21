/**
 * Cloud backup ownership: account keys (`u{id}`) are sequential, so only the
 * owner's token may read or write them; random device UUIDs stay open.
 */
import { beforeAll, describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { initDb } from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";

const app = express();
app.use(express.json());

let token = "";
let userId = 0;

beforeAll(async () => {
  initDb();
  registerRoutes(app);
  app.use(errorHandler);
  const res = await request(app).post("/api/auth/guest").set("x-device-id", "sync-test-device-0001");
  token = res.body.token as string;
  userId = res.body.user.id as number;
});

const backup = (key: string) => ({ userId: key, workoutHistory: [{ id: "w1" }], currentPlan: { plans: [] } });

describe("cloud backup", () => {
  it("lets the owner write and read an account backup", async () => {
    const key = `u${userId}`;
    const put = await request(app).post("/api/workouts/sync").set("Authorization", `Bearer ${token}`).send(backup(key));
    expect(put.status).toBe(200);
    const get = await request(app).get(`/api/workouts/sync/${key}`).set("Authorization", `Bearer ${token}`);
    expect(get.body.found).toBe(true);
    expect(get.body.workoutHistory).toHaveLength(1);
  });

  it("refuses an account backup without the owner's token", async () => {
    const key = `u${userId}`;
    expect((await request(app).get(`/api/workouts/sync/${key}`)).status).toBe(403);
    expect((await request(app).post("/api/workouts/sync").send(backup(key))).status).toBe(403);
    const other = jwt.sign({ sub: userId + 1, provider: "guest" }, process.env.JWT_SECRET!);
    expect((await request(app).get(`/api/workouts/sync/${key}`).set("Authorization", `Bearer ${other}`)).status).toBe(403);
  });

  it("accepts an expired but validly signed owner token", async () => {
    const expired = jwt.sign({ sub: userId, provider: "guest" }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await request(app).get(`/api/workouts/sync/u${userId}`).set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(200);
  });

  it("keeps anonymous device-UUID backups working", async () => {
    const key = "0b9c3f5e-1d2a-4c7b-9e8f-123456789abc";
    expect((await request(app).post("/api/workouts/sync").send(backup(key))).status).toBe(200);
    expect((await request(app).get(`/api/workouts/sync/${key}`)).body.found).toBe(true);
  });
});

describe("account lifecycle", () => {
  it("renews an expired token for an existing user", async () => {
    const expired = jwt.sign({ sub: userId, provider: "guest" }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(200);
    expect(jwt.decode(res.body.token)).toMatchObject({ sub: userId });
    const forged = jwt.sign({ sub: userId, provider: "guest" }, "wrong-secret");
    expect((await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });

  it("deletes the account with its backup and server data", async () => {
    const guest = await request(app).post("/api/auth/guest").set("x-device-id", "sync-test-device-0002");
    const t = guest.body.token as string;
    const id = guest.body.user.id as number;
    await request(app).post("/api/workouts/sync").set("Authorization", `Bearer ${t}`).send(backup(`u${id}`));
    const plan = await request(app).post("/api/plans").set("Authorization", `Bearer ${t}`).send({ name: "Weg damit" });
    expect(plan.status).toBeLessThan(300);

    expect((await request(app).delete("/api/auth/account").set("Authorization", `Bearer ${t}`)).status).toBe(200);
    expect((await request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${t}`)).status).toBe(401);
    const left = (await import("../db")).default;
    expect(left.prepare("SELECT count(*) n FROM device_cloud_sync WHERE user_id = ?").get(`u${id}`)).toEqual({ n: 0 });
    expect(left.prepare("SELECT count(*) n FROM plans WHERE user_id = ?").get(id)).toEqual({ n: 0 });
    expect(left.prepare("SELECT count(*) n FROM users WHERE id = ?").get(id)).toEqual({ n: 0 });
  });
});
