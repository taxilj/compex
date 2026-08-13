import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false, // integration tests share a DB — never run files concurrently
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
          fileParallelism: false, // shared DB — must not run files concurrently
          // Requires: DATABASE_URL pointing to a test DB + REDIS_URL
        },
      },
    ],
  },
}));