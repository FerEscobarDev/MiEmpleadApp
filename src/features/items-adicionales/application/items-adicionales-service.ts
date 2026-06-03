import type { ItemAdicional } from "@prisma/client";
import {
  listarItems,
  crearItem,
  actualizarItem,
  eliminarItem,
  buscarItemPorId,
} from "@/features/items-adicionales/data/items-adicionales-repository";
import type { ItemAdicionalInputDto } from "./schemas";

// Servicio de aplicación de items de pago adicional (architecture.md §2.3).
// Orquesta el repositorio (§2.5) y mapea entre la persistencia y el DTO del
// contrato (ItemAdicional): normaliza color (vacío ⇄ null) y resuelve el default
// de activo. Sin lógica de negocio compleja ni acceso directo a Prisma.

// DTO ItemAdicional del contrato (salida de la frontera).
export interface ItemAdicionalDto {
  id: string;
  nombre: string;
  valorUnitario: number;
  color: string | null;
  activo: boolean;
}

// Error de aplicación esperable: el item solicitado no existe.
export class ItemNoEncontradoError extends Error {
  constructor() {
    super("No existe el item de pago adicional solicitado.");
    this.name = "ItemNoEncontradoError";
  }
}

function toDto(item: ItemAdicional): ItemAdicionalDto {
  return {
    id: item.id,
    nombre: item.nombre,
    valorUnitario: item.valorUnitario,
    // En persistencia color es String no-nulo; la cadena vacía representa "sin
    // color" y se serializa como null para conformar el contrato (color nullable).
    color: item.color === "" ? null : item.color,
    activo: item.activo,
  };
}

// Normaliza el input del contrato a los datos persistibles del repositorio.
function toData(input: ItemAdicionalInputDto): {
  nombre: string;
  valorUnitario: number;
  color: string;
  activo: boolean;
} {
  return {
    nombre: input.nombre,
    valorUnitario: input.valorUnitario,
    color: input.color ?? "",
    activo: input.activo,
  };
}

export async function listarItemsAdicionales(
  empleadaId: string,
): Promise<ItemAdicionalDto[]> {
  const items = await listarItems(empleadaId);
  return items.map(toDto);
}

export async function crearItemAdicional(
  empleadaId: string,
  input: ItemAdicionalInputDto,
): Promise<ItemAdicionalDto> {
  const item = await crearItem(empleadaId, toData(input));
  return toDto(item);
}

export async function actualizarItemAdicional(
  itemId: string,
  input: ItemAdicionalInputDto,
): Promise<ItemAdicionalDto> {
  const existente = await buscarItemPorId(itemId);
  if (!existente) {
    throw new ItemNoEncontradoError();
  }
  const item = await actualizarItem(itemId, toData(input));
  return toDto(item);
}

export async function eliminarItemAdicional(itemId: string): Promise<void> {
  const existente = await buscarItemPorId(itemId);
  if (!existente) {
    throw new ItemNoEncontradoError();
  }
  await eliminarItem(itemId);
}
