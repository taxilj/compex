import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
      exclude: ["src/server.ts", "src/jobs/worker.ts"],
    },
    // Integration tests need a real DB — run with: vitest --project integration
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
          // Requires: DATABASE_URL pointing to a test DB + REDIS_URL
        },
      },
    ],
  },
});