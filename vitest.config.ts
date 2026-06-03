import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { TEST_DATABASE_URL } from "./vitest.test-db-path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Apunta el cliente Prisma a la base de pruebas desechable en los workers.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
    // Los tests de integración comparten un único archivo SQLite de prueba y
    // limpian las tablas entre casos (resetDatabase). Ejecutarlos en un solo
    // worker (sin paralelismo entre archivos) serializa el acceso a la base y
    // evita que el reset de un archivo borre datos en uso por otro.
    fileParallelism: false,
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
