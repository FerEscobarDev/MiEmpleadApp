import { tmpdir } from "node:os";
import { join } from "node:path";

// Ruta única y determinista de la base SQLite de pruebas. La comparten el
// global setup (que aplica el schema) y la config de Vitest (que la inyecta como
// DATABASE_URL en los workers). Determinista para que ambos coincidan sin pasar
// estado entre procesos.
export const TEST_DATABASE_FILE: string = join(tmpdir(), "miempleadapp-test.db");
export const TEST_DATABASE_URL: string = `file:${TEST_DATABASE_FILE}`;
