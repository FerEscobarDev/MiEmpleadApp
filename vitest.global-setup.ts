import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { TEST_DATABASE_FILE, TEST_DATABASE_URL } from "./vitest.test-db-path";

// Global setup de Vitest: provisiona una base SQLite desechable para los tests
// de la capa de datos (Epic 1.2). Aplica el schema con `prisma db push` (no
// interactivo) sobre un archivo fijo bajo el temp del SO. La URL se comparte con
// los workers vía vitest.config.ts (test.env) para que el cliente Prisma apunte
// a la misma base. Al terminar la suite elimina el archivo. Nunca toca dev.db.
export default function setup() {
  cleanup();
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  return () => {
    cleanup();
  };
}

function cleanup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${TEST_DATABASE_FILE}${suffix}`, { force: true });
  }
}
