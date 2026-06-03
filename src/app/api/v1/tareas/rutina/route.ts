import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import { rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { rutinaTareasInputSchema } from "@/features/tareas/application/schemas";
import {
  obtenerRutina,
  reemplazarRutinaTareas,
} from "@/features/tareas/application/rutina-service";

// Frontera HTTP de la rutina de tareas (architecture.md §2.2). Implementa
// obtenerRutinaTareas (GET, ambos roles) y actualizarRutinaTareas (PUT, empleador,
// RN-13). Valida la entrada con Zod (enum DiaSemana, descripcion no vacía, orden
// entero, horarios HH:mm y horaInicio ≤ horaFin). Sin lógica de negocio ni acceso
// directo a Prisma (conventions.md §4).

// El parámetro request no se usa en la lectura (la empleada se resuelve por la
// costura de auth); se acepta por la firma estándar de los Route Handlers.
export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    const empleadaId = await getCurrentEmpleadaId();
    const rutina = await obtenerRutina(empleadaId);
    return Response.json(rutina, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/tareas/rutina", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function PUT(request: Request): Promise<Response> {
  // RN-13: la empleada (token) no puede escribir la rutina.
  const rechazo = await rechazarSiNoEmpleador(request);
  if (rechazo) {
    return rechazo;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationErrorResponse({ body: "JSON inválido." });
  }

  const parsed = rutinaTareasInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const rutina = await reemplazarRutinaTareas(empleadaId, parsed.data);
    return Response.json(rutina, { status: 200 });
  } catch (error) {
    console.error("Error en PUT /api/v1/tareas/rutina", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
