import { z } from "zod";

// Esquema Zod de la frontera para items de pago adicional (architecture.md §5.4).
// La autoridad de validación está en el backend. valorUnitario es entero COP sin
// decimales y no negativo (RN-16). color y activo son opcionales en la entrada
// (ItemAdicionalInput del contrato); el default de activo se aplica aquí.

export const itemAdicionalInputSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  valorUnitario: z.int().min(0, "El valor unitario no puede ser negativo."),
  color: z.string().nullable().optional(),
  activo: z.boolean().optional().default(true),
});

export type ItemAdicionalInputDto = z.infer<typeof itemAdicionalInputSchema>;
