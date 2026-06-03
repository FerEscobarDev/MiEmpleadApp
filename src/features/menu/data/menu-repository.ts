import type { MenuConfig, MenuEntrada } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio del menú (architecture.md §2.5). Traduce a llamadas Prisma vía el
// cliente único; sin lógica de negocio (conventions.md §4). La periodicidad y las
// comidas se persisten como String/JSON (Nota SQLite). El reemplazo de entradas
// es atómico (transacción) para no dejar la plantilla a medias.

export interface MenuConfigData {
  comidas: string[];
  periodicidad: string;
}

export async function obtenerMenuConfig(
  empleadaId: string,
): Promise<MenuConfig | undefined> {
  const config = await db.menuConfig.findUnique({ where: { empleadaId } });
  return config ?? undefined;
}

export async function listarEntradas(
  menuConfigId: string,
): Promise<MenuEntrada[]> {
  return db.menuEntrada.findMany({
    where: { menuConfigId },
    orderBy: [{ semana: "asc" }, { diaSemana: "asc" }, { comida: "asc" }],
  });
}

// Upsert de la configuración del menú por empleada (una sola por empleada,
// @@unique empleadaId). No toca las entradas.
export async function guardarMenuConfig(
  empleadaId: string,
  datos: MenuConfigData,
): Promise<MenuConfig> {
  return db.menuConfig.upsert({
    where: { empleadaId },
    create: {
      empleadaId,
      comidas: datos.comidas,
      periodicidad: datos.periodicidad,
    },
    update: {
      comidas: datos.comidas,
      periodicidad: datos.periodicidad,
    },
  });
}

// Asegura que exista la MenuConfig de la empleada para poder colgar entradas; si
// no existe, la crea con los datos por defecto provistos. Devuelve la config.
export async function asegurarMenuConfig(
  empleadaId: string,
  porDefecto: MenuConfigData,
): Promise<MenuConfig> {
  const existente = await obtenerMenuConfig(empleadaId);
  if (existente) {
    return existente;
  }
  return db.menuConfig.create({
    data: {
      empleadaId,
      comidas: porDefecto.comidas,
      periodicidad: porDefecto.periodicidad,
    },
  });
}

export interface EntradaData {
  semana: number;
  diaSemana: string;
  comida: string;
  descripcion: string;
}

// Reemplazo total y atómico de las entradas de una MenuConfig: borra las actuales
// y crea las nuevas en una sola transacción.
export async function reemplazarEntradas(
  menuConfigId: string,
  entradas: EntradaData[],
): Promise<MenuEntrada[]> {
  await db.$transaction([
    db.menuEntrada.deleteMany({ where: { menuConfigId } }),
    db.menuEntrada.createMany({
      data: entradas.map((e) => ({
        menuConfigId,
        semana: e.semana,
        diaSemana: e.diaSemana,
        comida: e.comida,
        descripcion: e.descripcion,
      })),
    }),
  ]);
  return listarEntradas(menuConfigId);
}
