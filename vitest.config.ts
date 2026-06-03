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
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
