// Dominio puro del cálculo de liquidación (architecture.md §2.4): conteo de días
// laborales del mes completo (denominador, RN-01/RN-02), días laborales dentro
// del periodo de contrato (meses parciales, RN-06/RN-07) y valor-día entero en
// COP (RN-16). Sin IO, sin DB, sin fecha implícita: todo se recibe como parámetro
// y se opera sobre cadenas YYYY-MM-DD (zona America/Bogotá, RN-17), nunca sobre
// el parsing local de Date del host.

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Día de la semana del negocio. Coincide con el enum `DiaSemana` del contrato
 * de API (api-contract.md §2). Reutilizable por el resto del dominio.
 */
export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";

// getUTCDay() devuelve 0=domingo..6=sábado. Mapeo a los literales del contrato.
const DIA_SEMANA_POR_INDICE: DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function assertMesValido(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`mes invalido: ${month} (se espera un entero entre 1 y 12)`);
  }
}

function parsearFecha(isoDate: string): { year: number; month: number; day: number } {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new RangeError(`fecha invalida: "${isoDate}" (se espera el formato YYYY-MM-DD)`);
  }
  return {
    year: Number(isoDate.slice(0, 4)),
    month: Number(isoDate.slice(5, 7)),
    day: Number(isoDate.slice(8, 10)),
  };
}

/** Cantidad de días del mes calendario (maneja años bisiestos). */
function diasEnMes(year: number, month: number): number {
  // El día 0 del mes siguiente es el último día de este mes.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Enumera todas las fechas del mes como cadenas YYYY-MM-DD en orden ascendente.
 */
export function enumerarDiasDelMes(year: number, month: number): string[] {
  assertMesValido(month);
  const total = diasEnMes(year, month);
  const prefijo = `${year}-${String(month).padStart(2, "0")}-`;
  const dias: string[] = [];
  for (let d = 1; d <= total; d++) {
    dias.push(`${prefijo}${String(d).padStart(2, "0")}`);
  }
  return dias;
}

/**
 * Día de la semana de una fecha YYYY-MM-DD, independiente de la zona del proceso
 * (se calcula sobre UTC a partir de los componentes parseados de la cadena).
 */
export function diaSemanaDe(isoDate: string): DiaSemana {
  const { year, month, day } = parsearFecha(isoDate);
  const indice = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return DIA_SEMANA_POR_INDICE[indice];
}

/** ¿La fecha cae en un día configurado como laboral (RN-02)? */
export function esDiaLaboral(isoDate: string, diasLaborales: DiaSemana[]): boolean {
  return diasLaborales.includes(diaSemanaDe(isoDate));
}

/**
 * Total de días laborales del mes calendario completo (denominador del valor-día,
 * RN-01/RN-02). NO excluye festivos: un festivo en día laboral cuenta (RN-03).
 */
export function contarDiasLaboralesDelMes(
  year: number,
  month: number,
  diasLaborales: DiaSemana[],
): number {
  return enumerarDiasDelMes(year, month).filter((fecha) =>
    esDiaLaboral(fecha, diasLaborales),
  ).length;
}

/**
 * Días laborales del mes que caen dentro del periodo de contrato [inicio, fin]
 * (inclusive). En el mes de inicio solo cuentan desde fechaInicioContrato (RN-06);
 * en el mes de fin solo hasta fechaFinContrato (RN-07). fechaFinContrato = null
 * significa sin límite superior. El denominador del valor-día no se ve afectado.
 */
export function contarDiasLaboralesEnContrato(
  year: number,
  month: number,
  diasLaborales: DiaSemana[],
  fechaInicioContrato: string,
  fechaFinContrato: string | null,
): number {
  // Validar formato de las fechas de contrato (lanza RangeError si malformadas).
  parsearFecha(fechaInicioContrato);
  if (fechaFinContrato !== null) {
    parsearFecha(fechaFinContrato);
  }
  // Comparación lexicográfica: las cadenas YYYY-MM-DD ordenan igual que las fechas.
  return enumerarDiasDelMes(year, month).filter((fecha) => {
    if (!esDiaLaboral(fecha, diasLaborales)) return false;
    if (fecha < fechaInicioContrato) return false;
    if (fechaFinContrato !== null && fecha > fechaFinContrato) return false;
    return true;
  }).length;
}

/**
 * Valor-día entero en COP = round(salarioBase / diasLaboralesMes) con redondeo a
 * la mitad hacia arriba (política documentada en el spec; RN-01/RN-16). Si el
 * denominador es 0, retorna 0 (mes sin días laborales no paga; evita /0).
 */
export function calcularValorDia(salarioBase: number, diasLaboralesMes: number): number {
  if (diasLaboralesMes <= 0) return 0;
  return Math.round(salarioBase / diasLaboralesMes);
}
