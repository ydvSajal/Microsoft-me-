import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/web imports its own files as "@/…" (tsconfig paths).
  resolve: { alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./apps/web/", import.meta.url)) }] },
  test: {
    include: ["{apps,packages}/*/src/**/*.test.ts", "apps/web/{lib,app}/**/*.test.ts"],
  },
});
