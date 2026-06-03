import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { fechaQuerySchema } from "@/features/tareas/application/schemas";
import { obtenerTareasDelDia } from "@/features/tareas/application/cumplimiento-service";

// Frontera HTTP del checklist de tareas del día (architecture.md §2.2). Implementa
// obtenerTareasDelDia (GET /tareas/dia?fecha=, ambos roles). Valida la query `fecha`
// con Zod, delega en la aplicación (que mapea fecha→día de la semana TZ-safe vía el
// dominio) y serializa. Sin lógica de negocio ni acceso directo a Prisma.

export async function GET(request: Request): Promise<Response> {
  const fecha = new URL(request.url).searchParams.get("fecha");
  const parsed = fechaQuerySchema.safeParse(fecha);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const tareas = await obtenerTareasDelDia(empleadaId, parsed.data);
    return Response.json(tareas, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/tareas/dia", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
