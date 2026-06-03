import { z } from "zod";

// Esquemas Zod de la frontera para la liquidación (architecture.md §5.4). La
// autoridad de validación está en el backend. Fechas como YYYY-MM-DD; montos y
// cantidades enteros COP sin decimales (RN-16). Reglas de negocio (RN-05 validez
// de inasistencia, RN-11 cerrada) NO se validan aquí (dependen del estado/contrato
// y viven en la capa de aplicación/dominio); aquí solo se valida la forma.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const fechaIso = z
  .string()
  .regex(ISO_DATE, "La fecha debe tener formato YYYY-MM-DD.");

export const actualizarLiquidacionInputSchema = z.object({
  inasistencias: z.array(fechaIso).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "El itemId es obligatorio."),
        cantidad: z.int().min(0, "La cantidad no puede ser negativa."),
      }),
    )
    .optional(),
  montosPuntuales: z
    .array(
      z.object({
        descripcion: z.string().min(1, "La descripción es obligatoria."),
        monto: z.int("El monto debe ser un entero."),
      }),
    )
    .optional(),
  notas: z.string().optional(),
});

export type ActualizarLiquidacionInputDto = z.infer<
  typeof actualizarLiquidacionInputSchema
>;
