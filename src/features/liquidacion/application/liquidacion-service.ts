import type { Liquidacion as LiquidacionRow } from "@prisma/client";
import {
  buscarLiquidacionPorMes,
  crearLiquidacion,
  listarLiquidacionesDeEmpleada,
  cargarNovedades,
  reemplazarNovedades,
  type NovedadesLiquidacion,
  type ReemplazoItem,
} from "@/features/liquidacion/data/liquidacion-repository";
import {
  obtenerConfiguracionDeEmpleada,
  buscarEmpleadaPorId,
} from "@/features/config/data/empleada-repository";
import { listarItems } from "@/features/items-adicionales/data/items-adicionales-repository";
import { getHolidaysInMonth } from "@/features/liquidacion/domain/festivos";
import {
  calcularDesglose,
  validarInasistencias,
  type Desglose,
} from "@/features/liquidacion/domain/calculo";
import {
  construirCalendario,
  type DiaCalendario,
} from "@/features/liquidacion/domain/calendario";
import {
  contarDiasLaboralesEnContrato,
  type DiaSemana,
} from "@/features/liquidacion/domain/dias-laborales";
import { toIsoDate } from "@/features/config/application/date-iso";
import type { ActualizarLiquidacionInputDto } from "./schemas";

// Servicio de aplicación de la liquidación (architecture.md §2.3). Orquesta el
// dominio puro (cálculo/calendario, §2.4), el Servicio de Festivos (§2.7) y los
// repositorios (§2.5). NO contiene cálculo monetario propio (vive en el dominio)
// ni accede a Prisma directamente (lo hacen los repositorios). Mientras la
// liquidación es BORRADOR, el desglose se calcula en vivo con la configuración
// vigente (RN-09; el congelamiento es Epic 5.2).

// DTO LiquidacionResumen del contrato (salida de listarLiquidaciones).
export interface LiquidacionResumenDto {
  anio: number;
  mes: number;
  estado: string;
  total: number;
}

// DTO LiquidacionItem del contrato (salida; subtotal = valorUnitario × cantidad).
export interface LiquidacionItemDto {
  itemId: string;
  nombre: string;
  valorUnitario: number;
  cantidad: number;
  subtotal: number;
}

export interface MontoPuntualDto {
  id?: string;
  descripcion: string;
  monto: number;
}

// DTO Liquidacion del contrato (salida de obtener/actualizar). notas privada del
// empleador; la frontera la omite para la empleada vía stripNotas (RN-12).
export interface LiquidacionDto {
  anio: number;
  mes: number;
  estado: string;
  desglose: Desglose;
  calendario: DiaCalendario[];
  inasistencias: string[];
  items: LiquidacionItemDto[];
  montosPuntuales: MontoPuntualDto[];
  notas?: string;
}

// Resultados de negocio esperables como retorno explícito (conventions.md §6).
export type ObtenerLiquidacionResult =
  | { ok: true; liquidacion: LiquidacionDto }
  | { ok: false; error: "MES_FUERA_DE_CONTRATO" };

export type ActualizarLiquidacionResult =
  | { ok: true; liquidacion: LiquidacionDto }
  | { ok: false; error: "MES_FUERA_DE_CONTRATO" }
  | { ok: false; error: "LIQUIDACION_CERRADA" }
  | { ok: false; error: "INASISTENCIA_INVALIDA"; invalidas: string[] };

// Configuración resuelta de la empleada para alimentar el dominio.
interface ContextoCalculo {
  salarioBase: number;
  diasLaborales: DiaSemana[];
  fechaInicioContrato: string;
  fechaFinContrato: string | null;
}

async function resolverContexto(empleadaId: string): Promise<ContextoCalculo> {
  const [config, empleada] = await Promise.all([
    obtenerConfiguracionDeEmpleada(empleadaId),
    buscarEmpleadaPorId(empleadaId),
  ]);
  if (!empleada) {
    throw new Error(`Empleada no encontrada: ${empleadaId}`);
  }
  return {
    salarioBase: config?.salarioBase ?? 0,
    diasLaborales: (config?.diasLaborales as DiaSemana[]) ?? [],
    fechaInicioContrato: toIsoDate(empleada.fechaInicioContrato),
    fechaFinContrato: empleada.fechaFinContrato
      ? toIsoDate(empleada.fechaFinContrato)
      : null,
  };
}

// El mes está completamente fuera de contrato si ningún día laboral cae dentro del
// periodo [inicio, fin] (RN-06/RN-07; §Casos Límite "Mes fuera del contrato").
function mesFueraDeContrato(anio: number, mes: number, ctx: ContextoCalculo): boolean {
  return (
    contarDiasLaboralesEnContrato(
      anio,
      mes,
      ctx.diasLaborales,
      ctx.fechaInicioContrato,
      ctx.fechaFinContrato,
    ) === 0
  );
}

function desgloseDe(
  anio: number,
  mes: number,
  ctx: ContextoCalculo,
  festivos: string[],
  novedades: NovedadesLiquidacion,
): Desglose {
  return calcularDesglose({
    year: anio,
    month: mes,
    salarioBase: ctx.salarioBase,
    diasLaborales: ctx.diasLaborales,
    fechaInicioContrato: ctx.fechaInicioContrato,
    fechaFinContrato: ctx.fechaFinContrato,
    festivos,
    inasistencias: novedades.inasistencias,
    items: novedades.items.map((it) => ({
      valorUnitario: it.valorUnitario,
      cantidad: it.cantidad,
    })),
    montosPuntuales: novedades.montosPuntuales.map((m) => ({ monto: m.monto })),
  });
}

function armarDto(
  row: LiquidacionRow,
  ctx: ContextoCalculo,
  festivos: string[],
  novedades: NovedadesLiquidacion,
): LiquidacionDto {
  const desglose = desgloseDe(row.anio, row.mes, ctx, festivos, novedades);
  const calendario = construirCalendario({
    year: row.anio,
    month: row.mes,
    diasLaborales: ctx.diasLaborales,
    fechaInicioContrato: ctx.fechaInicioContrato,
    fechaFinContrato: ctx.fechaFinContrato,
    festivos,
    inasistencias: novedades.inasistencias,
  });
  const dto: LiquidacionDto = {
    anio: row.anio,
    mes: row.mes,
    estado: row.estado,
    desglose,
    calendario,
    inasistencias: novedades.inasistencias,
    items: novedades.items.map((it) => ({
      itemId: it.itemId ?? "",
      nombre: it.nombre,
      valorUnitario: it.valorUnitario,
      cantidad: it.cantidad,
      subtotal: it.valorUnitario * it.cantidad,
    })),
    montosPuntuales: novedades.montosPuntuales.map((m) => ({
      id: m.id,
      descripcion: m.descripcion,
      monto: m.monto,
    })),
  };
  if (row.notas !== null) {
    dto.notas = row.notas;
  }
  return dto;
}

// listarLiquidaciones: historial de la empleada con el total calculado en vivo.
export async function listarResumenLiquidaciones(
  empleadaId: string,
): Promise<LiquidacionResumenDto[]> {
  const liquidaciones = await listarLiquidacionesDeEmpleada(empleadaId);
  if (liquidaciones.length === 0) {
    return [];
  }
  const ctx = await resolverContexto(empleadaId);
  const resumenes = await Promise.all(
    liquidaciones.map(async (row) => {
      const festivos = getHolidaysInMonth(row.anio, row.mes);
      const novedades = await cargarNovedades(row.id);
      const desglose = desgloseDe(row.anio, row.mes, ctx, festivos, novedades);
      return {
        anio: row.anio,
        mes: row.mes,
        estado: row.estado,
        total: desglose.total,
      };
    }),
  );
  return resumenes;
}

// obtenerLiquidacion: obtiene (o inicializa BORRADOR) la liquidación del mes y
// arma el DTO con desglose + calendario. 409 si el mes está fuera de contrato.
export async function obtenerLiquidacionDelMes(
  empleadaId: string,
  anio: number,
  mes: number,
): Promise<ObtenerLiquidacionResult> {
  const ctx = await resolverContexto(empleadaId);
  let row = await buscarLiquidacionPorMes(empleadaId, anio, mes);
  if (!row && mesFueraDeContrato(anio, mes, ctx)) {
    return { ok: false, error: "MES_FUERA_DE_CONTRATO" };
  }
  if (!row) {
    row = await crearLiquidacion({ empleadaId, anio, mes });
  }
  const festivos = getHolidaysInMonth(anio, mes);
  const novedades = await cargarNovedades(row.id);
  return { ok: true, liquidacion: armarDto(row, ctx, festivos, novedades) };
}

// actualizarLiquidacion: reemplaza las novedades del borrador y recalcula en vivo.
export async function actualizarLiquidacionDelMes(
  empleadaId: string,
  anio: number,
  mes: number,
  input: ActualizarLiquidacionInputDto,
): Promise<ActualizarLiquidacionResult> {
  const ctx = await resolverContexto(empleadaId);
  let row = await buscarLiquidacionPorMes(empleadaId, anio, mes);

  if (!row && mesFueraDeContrato(anio, mes, ctx)) {
    return { ok: false, error: "MES_FUERA_DE_CONTRATO" };
  }
  if (row && row.estado === "CERRADA") {
    return { ok: false, error: "LIQUIDACION_CERRADA" };
  }

  const festivos = getHolidaysInMonth(anio, mes);

  // RN-05: validar inasistencias contra el calendario/contrato antes de persistir.
  if (input.inasistencias !== undefined) {
    const invalidas = validarInasistencias(input.inasistencias, {
      diasLaborales: ctx.diasLaborales,
      festivos,
      fechaInicioContrato: ctx.fechaInicioContrato,
      fechaFinContrato: ctx.fechaFinContrato,
    });
    if (invalidas.length > 0) {
      return { ok: false, error: "INASISTENCIA_INVALIDA", invalidas };
    }
  }

  if (!row) {
    row = await crearLiquidacion({ empleadaId, anio, mes });
  }

  // Resolver nombre/valorUnitario de cada item desde el catálogo vigente (RN-09:
  // el congelamiento real es Epic 5.2; en borrador se refleja el catálogo actual).
  let itemsReemplazo: ReemplazoItem[] | undefined;
  if (input.items !== undefined) {
    const catalogo = await listarItems(empleadaId);
    const porId = new Map(catalogo.map((it) => [it.id, it]));
    itemsReemplazo = input.items.map((entrada) => {
      const item = porId.get(entrada.itemId);
      return {
        itemId: item ? item.id : null,
        nombre: item ? item.nombre : "",
        valorUnitario: item ? item.valorUnitario : 0,
        cantidad: entrada.cantidad,
      };
    });
  }

  await reemplazarNovedades(row.id, {
    inasistencias: input.inasistencias,
    items: itemsReemplazo,
    montosPuntuales: input.montosPuntuales,
    notas: input.notas,
  });

  // Releer la fila por si notas cambió; recargar novedades persistidas.
  const actualizada = (await buscarLiquidacionPorMes(empleadaId, anio, mes)) ?? row;
  const novedades = await cargarNovedades(actualizada.id);
  return { ok: true, liquidacion: armarDto(actualizada, ctx, festivos, novedades) };
}
