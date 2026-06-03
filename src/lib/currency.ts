// Formateador único de moneda para toda la app (RN-16, conventions.md §9):
// pesos colombianos sin decimales. Centralizar aquí evita que los componentes
// construyan formateadores a mano.
const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Formatea un monto entero en pesos colombianos (COP) sin decimales.
 *
 * @param amount Monto entero en pesos (puede ser 0, positivo o negativo).
 * @returns El monto formateado como moneda COP según la región es-CO.
 */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}
