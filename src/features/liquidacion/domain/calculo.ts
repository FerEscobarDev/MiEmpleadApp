// Desglose de la liquidación mensual (architecture.md §2.4): función pura que
// compone el cálculo completo del pago a partir de la configuración, el periodo
// de contrato, los festivos del mes (provistos por el Servicio de Festivos,
// Epic 2.1) y las novedades. Reutiliza las primitivas de `dias-laborales.ts`
// (Spec 1); no reimplementa conteo de días, valor-día ni festivos.
// Montos enteros COP (RN-16); sin IO ni fecha implícita (RN-17).

import {
  contarDiasLaboralesDelMes,
  contarDiasLaboralesEnContrato,
  calcularValorDia,
  esDiaLaboral,
  type DiaSemana,
} from "./dias-laborales";

/** Item adicional usado en el mes: valor unitario congelado × cantidad (RN-08). */
export interface ItemLiquidacion {
  valorUnitario: number;
  cantidad: number;
}

/** Pago suelto de una vez, sin valor unitario (RN-08). */
export interface MontoPuntual {
  monto: number;
}

/** Contexto necesario para decidir la validez de una inasistencia (RN-05). */
export interface ContextoInasistencia {
  diasLaborales: DiaSemana[];
  festivos: string[];
  fechaInicioContrato: string;
  fechaFinContrato: string | null;
}

/** Entrada agregada del cálculo del desglose. */
export interface EntradaDesglose {
  year: number;
  month: number;
  salarioBase: number;
  diasLaborales: DiaSemana[];
  fechaInicioContrato: string;
  fechaFinContrato: string | null;
  festivos: string[];
  inasistencias: string[];
  items: ItemLiquidacion[];
  montosPuntuales: MontoPuntual[];
}

/** Desglose calculado. Mapea 1:1 al esquema `Desglose` del contrato (§2). */
export interface Desglose {
  diasLaboralesMes: number;
  festivosEnDiaLaboral: number;
  diasTrabajados: number;
  valorDia: number;
  subtotalDias: number;
  subtotalItems: number;
  subtotalMontosPuntuales: number;
  total: number;
}

/**
 * Una inasistencia es válida solo si la fecha es día laboral, no festivo y está
 * dentro del periodo de contrato [inicio, fin] inclusive (RN-05). Se opera sobre
 * cadenas YYYY-MM-DD: la comparación lexicográfica equivale a la cronológica.
 */
export function esInasistenciaValida(fecha: string, ctx: ContextoInasistencia): boolean {
  if (!esDiaLaboral(fecha, ctx.diasLaborales)) return false;
  if (ctx.festivos.includes(fecha)) return false;
  if (fecha < ctx.fechaInicioContrato) return false;
  if (ctx.fechaFinContrato !== null && fecha > ctx.fechaFinContrato) return false;
  return true;
}

/**
 * Devuelve las fechas de `inasistencias` que NO son válidas (RN-05). Lista vacía
 * si todas son válidas. Conserva el orden de entrada (incluye duplicados si los
 * hubiera, para reportar fielmente lo recibido).
 */
export function validarInasistencias(
  inasistencias: string[],
  ctx: ContextoInasistencia,
): string[] {
  return inasistencias.filter((fecha) => !esInasistenciaValida(fecha, ctx));
}

// Cuenta cuántos días laborales únicos dentro del contrato fueron faltados de
// forma válida. Únicos: un día no puede faltarse dos veces (EC-3).
function contarInasistenciasValidas(
  inasistencias: string[],
  ctx: ContextoInasistencia,
): number {
  const validasUnicas = new Set(
    inasistencias.filter((fecha) => esInasistenciaValida(fecha, ctx)),
  );
  return validasUnicas.size;
}

/**
 * Calcula el desglose completo de la liquidación del mes (RN-01..RN-08).
 * - Denominador = días laborales del mes completo (RN-01/RN-02).
 * - Festivos en día laboral: pagados, no descontados (RN-03).
 * - diasTrabajados = días laborales en contrato − inasistencias válidas (RN-04).
 * - total = subtotalDias + Σ items + Σ montos puntuales (RN-08).
 */
export function calcularDesglose(entrada: EntradaDesglose): Desglose {
  const {
    year,
    month,
    salarioBase,
    diasLaborales,
    fechaInicioContrato,
    fechaFinContrato,
    festivos,
    inasistencias,
    items,
    montosPuntuales,
  } = entrada;

  const diasLaboralesMes = contarDiasLaboralesDelMes(year, month, diasLaborales);
  const valorDia = calcularValorDia(salarioBase, diasLaboralesMes);

  const festivosEnDiaLaboral = festivos.filter((fecha) =>
    esDiaLaboral(fecha, diasLaborales),
  ).length;

  const diasLaboralesEnContrato = contarDiasLaboralesEnContrato(
    year,
    month,
    diasLaborales,
    fechaInicioContrato,
    fechaFinContrato,
  );

  const ctx: ContextoInasistencia = {
    diasLaborales,
    festivos,
    fechaInicioContrato,
    fechaFinContrato,
  };
  const inasistenciasValidas = contarInasistenciasValidas(inasistencias, ctx);

  const diasTrabajados = Math.max(0, diasLaboralesEnContrato - inasistenciasValidas);
  const subtotalDias = diasTrabajados * valorDia;

  const subtotalItems = items.reduce(
    (acc, item) => acc + item.valorUnitario * item.cantidad,
    0,
  );
  const subtotalMontosPuntuales = montosPuntuales.reduce((acc, m) => acc + m.monto, 0);

  const total = subtotalDias + subtotalItems + subtotalMontosPuntuales;

  return {
    diasLaboralesMes,
    festivosEnDiaLaboral,
    diasTrabajados,
    valorDia,
    subtotalDias,
    subtotalItems,
    subtotalMontosPuntuales,
    total,
  };
}
