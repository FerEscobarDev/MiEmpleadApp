import type { EnlaceAcceso } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio del enlace de acceso de la empleada (architecture.md §2.5 / §6).
// Único acceso a Prisma del enlace, vía el cliente único. Sin lógica de negocio:
// solo traduce a llamadas Prisma. Una sola fila por empleada (empleadaId @unique);
// el campo token guarda el HASH del token, no el token en claro (ver token.ts).

// Crea o reemplaza el enlace de la empleada con un nuevo hash de token y lo activa
// (regenerar invalida el anterior: se sobrescribe la misma fila — RN HU-02).
export async function guardarEnlace(
  empleadaId: string,
  tokenHash: string,
): Promise<EnlaceAcceso> {
  return db.enlaceAcceso.upsert({
    where: { empleadaId },
    create: { empleadaId, token: tokenHash, activo: true },
    update: { token: tokenHash, activo: true },
  });
}

// Revoca el enlace de la empleada (activo=false). Si no existe, no hace nada
// (idempotente): updateMany no falla cuando no hay filas que coincidan.
export async function revocarEnlace(empleadaId: string): Promise<void> {
  await db.enlaceAcceso.updateMany({
    where: { empleadaId },
    data: { activo: false },
  });
}

// Busca un enlace ACTIVO por el hash del token. Devuelve undefined si no existe
// o está revocado.
export async function buscarEnlaceActivoPorHash(
  tokenHash: string,
): Promise<EnlaceAcceso | undefined> {
  const enlace = await db.enlaceAcceso.findFirst({
    where: { token: tokenHash, activo: true },
  });
  return enlace ?? undefined;
}
