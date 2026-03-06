import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/__tests__/**/*.test.ts"],
    // Each test file gets its own isolated process so in-memory DBs don't collide
    pool: "forks",
    env: {
      DB_PATH: ":memory:",
      JWT_SECRET: "test-secret-do-not-use-in-production",
    },
  },
});
