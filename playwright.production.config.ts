import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "production-*.spec.ts",
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://187.77.89.8",
    ...devices["iPhone 13"],
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
});
