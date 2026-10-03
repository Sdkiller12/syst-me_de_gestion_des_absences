import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
    setupFiles: ["tests/setup.ts"],
    // Les tests d'intégration partagent la même base PostgreSQL (vidée par chacun) :
    // les fichiers s'exécutent l'un après l'autre pour ne pas se marcher dessus.
    fileParallelism: false,
  },
});
