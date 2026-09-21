import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    include: ["test/integration/**/*.test.ts"],
    fileParallelism: false,
    // A few integration files dynamically `await import("./helpers.js")`
    // inside beforeAll (rather than a static top-level import) so a
    // per-describe module reset works alongside vi.mock. The first such
    // import in a process cold-compiles the whole app-building module
    // graph, which can exceed Vitest's 10s default hookTimeout on a
    // resource-constrained CI/sandbox runner even though it's well under
    // a second on a typical dev machine. Raising it here is a global,
    // test-behavior-neutral safety margin -- it does not change what any
    // test asserts, only how long a hook may take before being flagged.
    hookTimeout: 30_000,
  },
}));
