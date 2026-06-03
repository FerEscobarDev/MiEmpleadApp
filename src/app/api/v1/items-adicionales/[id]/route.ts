import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { itemAdicionalInputSchema } from "@/features/items-adicionales/application/schemas";
import {
  actualizarItemAdicional,
  eliminarItemAdicional,
  ItemNoEncontradoError,
} from "@/features/items-adicionales/application/items-adicionales-service";

// Frontera HTTP del item de pago adicional por id (architecture.md §2.2).
// Implementa actualizarItemAdicional (PUT) y eliminarItemAdicional (DELETE) del
// contrato. Valida la entrada con Zod, delega en la capa de aplicación y serializa
// la respuesta o el envelope de error único. Sin lógica de negocio ni acceso
// directo a Prisma (conventions.md §4).

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isItemNoEncontrado(error: unknown): boolean {
  return error instanceof ItemNoEncontradoError;
}

const ITEM_NO_ENCONTRADO = "ITEM_NO_ENCONTRADO";

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
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

  const { id } = await context.params;
  try {
    const item = await actualizarItemAdicional(id, parsed.data);
    return Response.json(item, { status: 200 });
  } catch (error) {
    if (isItemNoEncontrado(error)) {
      return errorResponse(404, ITEM_NO_ENCONTRADO, "El item no existe.");
    }
    console.error("Error en PUT /api/v1/items-adicionales/[id]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  void _request;
  const { id } = await context.params;
  try {
    await eliminarItemAdicional(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isItemNoEncontrado(error)) {
      return errorResponse(404, ITEM_NO_ENCONTRADO, "El item no existe.");
    }
    console.error("Error en DELETE /api/v1/items-adicionales/[id]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
