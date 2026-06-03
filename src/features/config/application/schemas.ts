import { z } from "zod";
import { isIsoDate } from "./date-iso";

// Esquemas Zod de la frontera (architecture.md §5.4). La autoridad de validación
// está en el backend. Los enums del contrato (DiaSemana) se validan aquí porque en
// SQLite se almacenan como String/JSON (architecture.md §4 Nota SQLite).

// Enum DiaSemana del contrato (api-contract.openapi.yaml).
export const diaSemanaSchema = z.enum([
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
]);

const isoDateString = z
  .string()
  .refine((value) => isIsoDate(value), { message: "Fecha inválida (formato YYYY-MM-DD)." });

// DTO Empleada de entrada (PUT /empleada).
export const empleadaInputSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio."),
  fechaNacimiento: isoDateString,
  fechaInicioContrato: isoDateString,
  fechaFinContrato: isoDateString.nullable().optional(),
});

export type EmpleadaInput = z.infer<typeof empleadaInputSchema>;

// DTO Configuracion de entrada (PUT /configuracion).
export const configuracionInputSchema = z.object({
  salarioBase: z.int().min(0, "El salario base no puede ser negativo."),
  diasLaborales: z.array(diaSemanaSchema),
});

export type ConfiguracionInputDto = z.infer<typeof configuracionInputSchema>;
