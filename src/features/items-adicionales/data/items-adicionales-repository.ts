import type { ItemAdicional } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio delgado de items de pago adicional (architecture.md §2.5). Solo
// traduce a llamadas Prisma vía el cliente único; sin lógica de negocio
// (conventions.md §4). El default de color/activo y el mapeo a DTO viven en la
// capa de aplicación; aquí se persisten los datos ya normalizados.

// Datos persistibles de un item (sin id ni empleadaId). color es String no-nulo
// en el schema; la cadena vacía representa "sin color" (lo normaliza el servicio).
export interface ItemAdicionalData {
  nombre: string;
  valorUnitario: number;
  color: string;
  activo: boolean;
}

export async function listarItems(empleadaId: string): Promise<ItemAdicional[]> {
  return db.itemAdicional.findMany({
    where: { empleadaId },
    orderBy: { nombre: "asc" },
  });
}

export async function buscarItemPorId(
  itemId: string,
): Promise<ItemAdicional | undefined> {
  const item = await db.itemAdicional.findUnique({ where: { id: itemId } });
  return item ?? undefined;
}

export async function crearItem(
  empleadaId: string,
  datos: ItemAdicionalData,
): Promise<ItemAdicional> {
  return db.itemAdicional.create({
    data: {
      empleadaId,
      nombre: datos.nombre,
      valorUnitario: datos.valorUnitario,
      color: datos.color,
      activo: datos.activo,
    },
  });
}

export async function actualizarItem(
  itemId: string,
  datos: ItemAdicionalData,
): Promise<ItemAdicional> {
  return db.itemAdicional.update({
    where: { id: itemId },
    data: {
      nombre: datos.nombre,
      valorUnitario: datos.valorUnitario,
      color: datos.color,
      activo: datos.activo,
    },
  });
}

// Borra el item del catálogo. El snapshot histórico en LiquidacionItem sobrevive:
// itemId tiene onDelete: SetNull, así que el congelamiento (RN-09) no se altera.
export async function eliminarItem(itemId: string): Promise<void> {
  await db.itemAdicional.delete({ where: { id: itemId } });
}
