import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "regras", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      // Telas com componentes do UI SDK: jsdom com as lacunas preenchidas (skill ui-sdk, testing.md).
      { resolve: { alias }, test: { name: "telas", include: ["tests/ui/**/*.test.tsx"], environment: "jsdom", setupFiles: ["tests/ui/setup-jsdom.ts"] } },
    ],
  },
});
