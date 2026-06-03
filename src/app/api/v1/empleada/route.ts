import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { empleadaInputSchema } from "@/features/config/application/schemas";
import {
  obtenerEmpleada,
  guardarEmpleada,
} from "@/features/config/application/empleada-service";

// Frontera HTTP de la ficha de la empleada (architecture.md §2.2). Implementa
// obtenerEmpleada (GET) y actualizarEmpleada (PUT) del contrato. Valida la entrada
// con Zod, delega en la capa de aplicación y serializa la respuesta o el envelope
// de error único. NO contiene lógica de negocio ni accede a Prisma directamente
// (conventions.md §4). La identidad/rol se resolverán por la costura de auth en
// Epic 4 (RN-13) sin reescribir este handler.

// El parámetro request no se usa en la lectura (la empleada se resuelve por la
// costura de auth), pero se acepta por la firma estándar de los Route Handlers.
export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    const empleadaId = await getCurrentEmpleadaId();
    const empleada = await obtenerEmpleada(empleadaId);
    if (!empleada) {
      return errorResponse(
        404,
        "EMPLEADA_NO_ENCONTRADA",
        "No existe una ficha de empleada.",
      );
    }
    return Response.json(empleada, { status: 200 });
  } catch (error) {
    // La empleada aún no existe (costura): se trata como ficha no encontrada.
    if (isEmpleadaNoResuelta(error)) {
      return errorResponse(
        404,
        "EMPLEADA_NO_ENCONTRADA",
        "No existe una ficha de empleada.",
      );
    }
    console.error("Error en GET /api/v1/empleada", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function PUT(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationErrorResponse({ body: "JSON inválido." });
  }

  const parsed = empleadaInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const empleada = await guardarEmpleada(empleadaId, parsed.data);
    return Response.json(empleada, { status: 200 });
  } catch (error) {
    if (isEmpleadaNoResuelta(error)) {
      return errorResponse(
        404,
        "EMPLEADA_NO_ENCONTRADA",
        "No existe una ficha de empleada.",
      );
    }
    console.error("Error en PUT /api/v1/empleada", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

function isEmpleadaNoResuelta(error: unknown): boolean {
  return error instanceof Error && error.name === "EmpleadaNoResueltaError";
}
