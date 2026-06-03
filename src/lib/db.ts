import { PrismaClient } from "@prisma/client";

// Cliente Prisma único de la app (architecture.md §2.5 / §6, conventions.md §3/§4).
// Ningún otro módulo instancia PrismaClient. En desarrollo se reutiliza la
// misma instancia entre recargas (hot-reload) guardándola en globalThis para
// no agotar conexiones; ver https://pris.ly/d/help/next-js-best-practices.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();
  // Modo WAL de SQLite (ADR-002): mejora la concurrencia lectura/escritura.
  // Se ejecuta de forma perezosa en la primera conexión; no bloquea el import.
  void client.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch(() => {
    // En bases :memory: o entornos sin WAL el pragma puede no aplicar;
    // no es un error de negocio y no debe tumbar el arranque.
  });
  return client;
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
