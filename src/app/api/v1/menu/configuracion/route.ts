import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import { rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { menuConfigInputSchema } from "@/features/menu/application/schemas";
import { guardarConfiguracionMenu } from "@/features/menu/application/menu-service";

// Frontera HTTP del menú — configuración (architecture.md §2.2). Implementa
// actualizarConfiguracionMenu (PUT /menu/configuracion) del contrato. Valida la
// entrada con Zod (comidas no vacías + enum Periodicidad), aplica el guard de rol
// (RN-13: la empleada no escribe) y delega en la aplicación. Sin lógica de negocio
// ni acceso directo a Prisma (conventions.md §4).

export async function PUT(request: Request): Promise<Response> {
  // RN-13: la empleada (token) no puede escribir la configuración del menú.
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

  const parsed = menuConfigInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const config = await guardarConfiguracionMenu(empleadaId, parsed.data);
    return Response.json(config, { status: 200 });
  } catch (error) {
    console.error("Error en PUT /api/v1/menu/configuracion", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
