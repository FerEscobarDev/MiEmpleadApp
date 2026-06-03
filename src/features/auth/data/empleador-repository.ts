import type { Empleador } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio de empleador del feature auth (architecture.md §2.6 / §2.5).
// Único acceso a Prisma de la autenticación, vía el cliente único (architecture.md
// §6, conventions.md §4). Sin lógica de negocio: solo traduce a llamadas Prisma.

export async function buscarEmpleadorPorEmail(
  email: string,
): Promise<Empleador | undefined> {
  const empleador = await db.empleador.findUnique({ where: { email } });
  return empleador ?? undefined;
}
