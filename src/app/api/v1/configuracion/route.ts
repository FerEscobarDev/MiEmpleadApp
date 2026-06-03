import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { configuracionInputSchema } from "@/features/config/application/schemas";
import {
  obtenerConfiguracion,
  guardarConfiguracion,
} from "@/features/config/application/configuracion-service";

// Frontera HTTP de la configuración (architecture.md §2.2). Implementa
// obtenerConfiguracion (GET) y actualizarConfiguracion (PUT) del contrato. Valida
// la entrada con Zod (incluyendo el enum DiaSemana), delega en la aplicación y
// serializa la respuesta o el envelope de error único. Sin lógica de negocio ni
// acceso directo a Prisma (conventions.md §4). Autorización por rol diferida al
// Epic 4 vía la costura de auth (RN-13).

export async function GET(): Promise<Response> {
  try {
    const empleadaId = await getCurrentEmpleadaId();
    const config = await obtenerConfiguracion(empleadaId);
    return Response.json(config, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/configuracion", error);
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

  const parsed = configuracionInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const config = await guardarConfiguracion(empleadaId, parsed.data);
    return Response.json(config, { status: 200 });
  } catch (error) {
    console.error("Error en PUT /api/v1/configuracion", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
