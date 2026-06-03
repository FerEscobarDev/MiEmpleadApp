import { db } from "@/lib/db";

// Soporte de pruebas para la capa de datos (data-access-modules / spec hermano).
// Usa una base SQLite REAL desechable (sin mocks, conventions.md §7). El archivo
// de la base de prueba y la aplicación del schema los provee el globalSetup de
// Vitest (vitest.global-setup.ts), que ejecuta `prisma db push` sobre una base
// dedicada apuntada por DATABASE_URL antes de cargar cualquier test. Aquí solo
// nos conectamos y limpiamos las tablas entre pruebas.

// Orden de borrado respetando dependencias (hijos antes que padres) para no
// depender del orden de las cascadas.
const DELETION_ORDER = [
  "cumplimientoTarea",
  "rutinaTarea",
  "menuEntrada",
  "menuConfig",
  "inasistencia",
  "liquidacionItem",
  "montoPuntual",
  "liquidacion",
  "itemAdicional",
  "enlaceAcceso",
  "configuracion",
  "empleada",
  "empleador",
] as const;

export async function setupTestDatabase(): Promise<void> {
  await db.$connect();
  await resetDatabase();
}

export async function resetDatabase(): Promise<void> {
  for (const model of DELETION_ORDER) {
    // Acceso dinámico al delegado del modelo; cada uno expone deleteMany.
    await (db as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[
      model
    ].deleteMany();
  }
}

export async function teardownTestDatabase(): Promise<void> {
  await resetDatabase();
  await db.$disconnect();
}
