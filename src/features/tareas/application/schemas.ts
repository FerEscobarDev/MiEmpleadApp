import { z } from "zod";
import { diaSemanaSchema } from "@/features/config/application/schemas";
import { isIsoDate } from "@/features/config/application/date-iso";

// Esquemas Zod de la frontera de tareas (architecture.md §5.4). La autoridad de
// validación está en el backend. El enum DiaSemana se reutiliza del feature config
// (no se duplica); en SQLite se almacena como String (Nota SQLite). El formato de
// hora "HH:mm" 24h y la coherencia horaInicio ≤ horaFin se validan aquí.

// Formato "HH:mm" 24h: 00:00..23:59.
const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const horaSchema = z
  .string()
  .regex(HORA_PATTERN, "La hora debe tener formato HH:mm (24h).")
  .nullable()
  .optional();

// Descripción no vacía ni solo espacios.
const descripcionSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "La descripción no puede estar vacía.",
});

// DTO RutinaTareaInput (parte de PUT /tareas/rutina). horaInicio/horaFin opcionales;
// si ambas están presentes, horaInicio ≤ horaFin (comparación lexicográfica válida
// por el cero a la izquierda del formato HH:mm).
export const rutinaTareaInputSchema = z
  .object({
    diaSemana: diaSemanaSchema,
    descripcion: descripcionSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    orden: z.int(),
  })
  .refine(
    (t) =>
      t.horaInicio == null || t.horaFin == null || t.horaInicio <= t.horaFin,
    { message: "horaInicio no puede ser posterior a horaFin." },
  );

export type RutinaTareaInputDto = z.infer<typeof rutinaTareaInputSchema>;

// DTO de entrada del PUT /tareas/rutina: un arreglo de tareas (reemplazo total).
export const rutinaTareasInputSchema = z.array(rutinaTareaInputSchema);

// Fecha ISO YYYY-MM-DD válida (rechaza fechas calendario imposibles). Reutiliza
// isIsoDate (no duplica la validación de fecha del feature config).
const isoDateString = z
  .string()
  .refine((value) => isIsoDate(value), {
    message: "Fecha inválida (formato YYYY-MM-DD).",
  });

// Query `fecha` de obtenerTareasDelDia.
export const fechaQuerySchema = isoDateString;

// DTO MarcarTareaInput (PUT /tareas/cumplimiento).
export const marcarTareaInputSchema = z.object({
  fecha: isoDateString,
  rutinaTareaId: z.string().min(1, "rutinaTareaId es obligatorio."),
  hecha: z.boolean(),
});

export type MarcarTareaInputDto = z.infer<typeof marcarTareaInputSchema>;

// Rango de fechas de obtenerHistoricoTareas: desde ≤ hasta (comparación
// lexicográfica válida por el formato YYYY-MM-DD).
export const rangoHistoricoSchema = z
  .object({
    desde: isoDateString,
    hasta: isoDateString,
  })
  .refine((r) => r.desde <= r.hasta, {
    message: "El rango es inválido: 'desde' no puede ser posterior a 'hasta'.",
  });

export type RangoHistoricoDto = z.infer<typeof rangoHistoricoSchema>;
