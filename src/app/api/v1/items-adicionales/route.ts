import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import { rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { itemAdicionalInputSchema } from "@/features/items-adicionales/application/schemas";
import {
  listarItemsAdicionales,
  crearItemAdicional,
} from "@/features/items-adicionales/application/items-adicionales-service";

// Frontera HTTP del catálogo de items de pago adicional (architecture.md §2.2).
// Implementa listarItemsAdicionales (GET) y crearItemAdicional (POST) del contrato.
// Valida la entrada con Zod, delega en la capa de aplicación y serializa la
// respuesta o el envelope de error único. NO contiene lógica de negocio ni accede
// a Prisma directamente (conventions.md §4). La autorización por rol (RN-13) se
// aplicará en Epic 4.2 vía la costura de auth, sin reescribir este handler.

// El parámetro request no se usa en la lectura (la empleada se resuelve por la
// costura de auth), pero se acepta por la firma estándar de los Route Handlers.
export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    const empleadaId = await getCurrentEmpleadaId();
    const items = await listarItemsAdicionales(empleadaId);
    return Response.json(items, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/items-adicionales", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function POST(request: Request): Promise<Response> {
  // RN-13: la empleada (token) no puede crear items.
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

  const parsed = itemAdicionalInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const item = await crearItemAdicional(empleadaId, parsed.data);
    return Response.json(item, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/v1/items-adicionales", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
