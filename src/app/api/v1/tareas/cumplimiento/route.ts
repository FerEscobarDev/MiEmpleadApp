import { resolverRol } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { marcarTareaInputSchema } from "@/features/tareas/application/schemas";
import {
  marcarTarea,
  TareaNoEncontradaError,
} from "@/features/tareas/application/cumplimiento-service";

// Frontera HTTP del marcado de cumplimiento (architecture.md §2.2). Implementa
// marcarTarea (PUT /tareas/cumplimiento). Es la ÚNICA escritura permitida a la
// empleada (RN-13): por eso NO usa rechazarSiNoEmpleador, sino que exige una
// identidad válida (empleador O empleada) vía resolverRol; sin identidad → 401. La
// pertenencia de la tarea a la empleada (aislamiento) la verifica la aplicación → 404.

const NO_AUTORIZADO = "NO_AUTORIZADO";
const NO_ENCONTRADO = "NO_ENCONTRADO";

export async function PUT(request: Request): Promise<Response> {
  // BR-5: se requiere identidad válida (cualquier rol). Sin identidad → 401.
  const contexto = await resolverRol(request);
  if (!contexto) {
    return errorResponse(401, NO_AUTORIZADO, "Se requiere una identidad válida.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationErrorResponse({ body: "JSON inválido." });
  }

  const parsed = marcarTareaInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const cumplimiento = await marcarTarea(contexto.empleadaId, parsed.data);
    return Response.json(cumplimiento, { status: 200 });
  } catch (error) {
    // BR-3: la tarea no pertenece a la empleada del contexto (o no existe) → 404.
    if (error instanceof TareaNoEncontradaError) {
      return errorResponse(404, NO_ENCONTRADO, error.message);
    }
    console.error("Error en PUT /api/v1/tareas/cumplimiento", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
