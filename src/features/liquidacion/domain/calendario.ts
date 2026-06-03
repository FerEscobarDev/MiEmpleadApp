// Modelo de días del calendario (architecture.md §2.4): función pura que asigna
// a cada día del mes un único TipoDiaCalendario según los días laborales, el
// periodo de contrato, los festivos provistos (Epic 2.1) y las inasistencias.
// Reutiliza las primitivas de `dias-laborales.ts` (Spec 1) y la validez de
// inasistencia de `calculo.ts` (Spec 2, RN-05). Sin IO; fechas como cadenas
// YYYY-MM-DD (RN-17).

import { enumerarDiasDelMes, esDiaLaboral, type DiaSemana } from "./dias-laborales";
import { esInasistenciaValida } from "./calculo";

/** Tipo de día del calendario. Valores idénticos al enum del contrato (§2). */
export type TipoDiaCalendario =
  | "TRABAJADO"
  | "INASISTENCIA"
  | "FESTIVO"
  | "NO_LABORAL"
  | "FUERA_CONTRATO";

/** Un día del calendario coloreado. Mapea al esquema `DiaCalendario` (§2). */
export interface DiaCalendario {
  fecha: string;
  tipo: TipoDiaCalendario;
}

/** Entrada para construir el modelo de calendario del mes. */
export interface EntradaCalendario {
  year: number;
  month: number;
  diasLaborales: DiaSemana[];
  fechaInicioContrato: string;
  fechaFinContrato: string | null;
  festivos: string[];
  inasistencias: string[];
}

// Precedencia (el primer caso que aplica gana): NO_LABORAL > FUERA_CONTRATO >
// FESTIVO > INASISTENCIA > TRABAJADO. Un festivo o inasistencia en día no
// laboral o fuera de contrato es irrelevante (RN-02/RN-03/RN-05).
function tipoDeDia(fecha: string, entrada: EntradaCalendario): TipoDiaCalendario {
  const { diasLaborales, fechaInicioContrato, fechaFinContrato, festivos, inasistencias } =
    entrada;

  if (!esDiaLaboral(fecha, diasLaborales)) return "NO_LABORAL";
  if (fecha < fechaInicioContrato) return "FUERA_CONTRATO";
  if (fechaFinContrato !== null && fecha > fechaFinContrato) return "FUERA_CONTRATO";
  if (festivos.includes(fecha)) return "FESTIVO";

  // En este punto la fecha es día laboral, en contrato y no festivo; una
  // inasistencia registrada aquí es válida (RN-05) y produce el tipo.
  if (
    inasistencias.includes(fecha) &&
    esInasistenciaValida(fecha, {
      diasLaborales,
      festivos,
      fechaInicioContrato,
      fechaFinContrato,
    })
  ) {
    return "INASISTENCIA";
  }

  return "TRABAJADO";
}

/**
 * Construye el modelo de días del mes para el calendario visual: un elemento por
 * día (orden ascendente) con su `tipo` según las reglas de precedencia.
 */
export function construirCalendario(entrada: EntradaCalendario): DiaCalendario[] {
  return enumerarDiasDelMes(entrada.year, entrada.month).map((fecha) => ({
    fecha,
    tipo: tipoDeDia(fecha, entrada),
  }));
}
