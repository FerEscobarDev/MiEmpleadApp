import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import { rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { menuEntradasInputSchema } from "@/features/menu/application/schemas";
import {
  actualizarEntradasMenu,
  MenuValidacionError,
} from "@/features/menu/application/menu-service";

// Frontera HTTP del menú — entradas de la plantilla (architecture.md §2.2).
// Implementa actualizarMenu (PUT /menu/entradas) del contrato. Valida la forma con
// Zod (enum DiaSemana, semana ≥0, comida no vacía); el rango de semana por
// periodicidad (RN-14) y el acoplamiento comida ∈ comidas (RN-19) los valida la
// aplicación y se traducen a 422. Guard de rol (RN-13). Sin acceso a Prisma aquí.

export async function PUT(request: Request): Promise<Response> {
  // RN-13: la empleada (token) no puede escribir las entradas del menú.
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

  const parsed = menuEntradasInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const empleadaId = await getCurrentEmpleadaId();
    const entradas = await actualizarEntradasMenu(empleadaId, parsed.data);
    return Response.json(entradas, { status: 200 });
  } catch (error) {
    // Reglas dependientes de la configuración (rango de semana / comida) → 422.
    if (error instanceof MenuValidacionError) {
      return validationErrorResponse(error.details);
    }
    console.error("Error en PUT /api/v1/menu/entradas", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
