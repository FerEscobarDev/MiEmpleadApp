import { colombianHolidays } from "colombian-holidays";

// Servicio de Festivos (Ley Emiliani). Funcion pura y determinista: recibe
// anio/mes y devuelve las fechas festivas observadas en zona America/Bogota
// como cadenas YYYY-MM-DD. La fuente es la libreria colombian-holidays; no se
// hardcodea ninguna fecha (architecture.md §6, conventions.md §4).

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Por que celebrationDate y no date: la libreria expone `date` como la fecha
// liturgica original y `celebrationDate` como la fecha observada tras aplicar
// la Ley Emiliani (el lunes trasladado). Para el negocio (RN-03) importa el dia
// en que efectivamente no se trabaja, es decir la fecha observada.
function observedHolidayDatesForYear(year: number): string[] {
  // valueAsDate: false selecciona la sobrecarga que devuelve fechas como
  // cadenas YYYY-MM-DD (ColombianHoliday), no como objetos Date.
  return colombianHolidays({ year, valueAsDate: false }).map(
    (holiday) => holiday.celebrationDate,
  );
}

/**
 * Festivos colombianos observados (post Ley Emiliani) que caen en el mes dado.
 * Devuelve cadenas YYYY-MM-DD en zona America/Bogota, ordenadas y sin duplicados.
 */
export function getHolidaysInMonth(year: number, month: number): string[] {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`mes invalido: ${month} (se espera un entero entre 1 y 12)`);
  }

  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;
  const datesInMonth = observedHolidayDatesForYear(year).filter((date) =>
    date.startsWith(monthPrefix),
  );

  return Array.from(new Set(datesInMonth)).sort();
}

/**
 * Indica si una fecha (YYYY-MM-DD, zona America/Bogota) es festivo observado.
 * Trabaja sobre cadenas para ser independiente de la zona horaria del proceso.
 */
export function isHoliday(isoDate: string): boolean {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new RangeError(`fecha invalida: "${isoDate}" (se espera el formato YYYY-MM-DD)`);
  }

  const year = Number(isoDate.slice(0, 4));
  return observedHolidayDatesForYear(year).includes(isoDate);
}
