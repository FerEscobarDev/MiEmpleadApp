// Conversión entre fecha ISO-8601 `YYYY-MM-DD` (DTO de la frontera, contrato) y
// `Date` (persistencia Prisma). Las fechas de negocio son fechas civiles sin hora;
// se anclan a medianoche UTC para que el round-trip conserve el día exacto sin que
// la zona horaria del entorno corra la fecha (architecture.md §4 / RN-17).

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  // Rechaza fechas calendario imposibles normalizadas por Date (ej. 2026-02-31).
  return toIsoDate(date) === value;
}

export function isoToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
