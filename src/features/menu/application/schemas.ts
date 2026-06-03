import { z } from "zod";
import { diaSemanaSchema } from "@/features/config/application/schemas";

// Esquemas Zod de la frontera del menú (architecture.md §5.4). La autoridad de
// validación está en el backend. Los enums del contrato (DiaSemana, Periodicidad)
// se validan aquí porque en SQLite se almacenan como String (architecture.md §4
// Nota SQLite). El enum DiaSemana se reutiliza del feature config para no duplicar.

// Enum Periodicidad del contrato (api-contract.openapi.yaml).
export const periodicidadSchema = z.enum(["SEMANAL", "QUINCENAL", "MENSUAL"]);

// Una comida es una cadena no vacía (ni solo espacios) — RN-19.
const comidaSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "La comida no puede estar vacía.",
  });

// DTO MenuConfig de entrada (PUT /menu/configuracion). comidas: al menos una
// comida no vacía; periodicidad dentro del enum.
export const menuConfigInputSchema = z.object({
  comidas: z.array(comidaSchema).min(1, "Debe haber al menos una comida."),
  periodicidad: periodicidadSchema,
});

export type MenuConfigInputDto = z.infer<typeof menuConfigInputSchema>;

// DTO MenuEntrada de entrada (parte de PUT /menu/entradas). El rango de semana
// (dependiente de la periodicidad) y el acoplamiento comida ∈ comidas se validan
// en la capa de aplicación, no aquí (requieren la configuración persistida).
export const menuEntradaInputSchema = z.object({
  semana: z.int().min(0, "La semana no puede ser negativa."),
  diaSemana: diaSemanaSchema,
  comida: comidaSchema,
  descripcion: z.string(),
});

// DTO de entrada del PUT /menu/entradas: un arreglo de entradas.
export const menuEntradasInputSchema = z.array(menuEntradaInputSchema);

export type MenuEntradaInputDto = z.infer<typeof menuEntradaInputSchema>;
