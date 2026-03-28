import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 20_000,
    projects: [
      "packages/db",
      "packages/adapters/opencode-local",
      "packages/plugins/sdk",
      "packages/plugins/examples/plugin-github-coding-sync-example",
      "server",
      "ui",
      "cli",
    ],
  },
});
