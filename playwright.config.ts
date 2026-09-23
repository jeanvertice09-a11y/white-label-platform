import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/pw",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "bun run --cwd apps/web dev -- --host 127.0.0.1", url: "http://127.0.0.1:5173/login", reuseExistingServer: !process.env["CI"], timeout: 120_000, env: { ...process.env, HOST: "localhost" }, stdout: "pipe", stderr: "pipe" },
});
