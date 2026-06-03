import { resolverRol, esEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { rangoHistoricoSchema } from "@/features/tareas/application/schemas";
import { obtenerHistorico } from "@/features/tareas/application/cumplimiento-service";

// Frontera HTTP del histórico de cumplimiento (architecture.md §2.2). Implementa
// obtenerHistoricoTareas (GET /tareas/historico?desde=&hasta=). SOLO empleador
// (RN-13): sin identidad → 401; rol empleada → 403. Valida el rango con Zod
// (formato YYYY-MM-DD y desde ≤ hasta) → 422. Sin acceso directo a Prisma.

const NO_AUTORIZADO = "NO_AUTORIZADO";

export async function GET(request: Request): Promise<Response> {
  const contexto = await resolverRol(request);
  if (!contexto) {
    return errorResponse(401, NO_AUTORIZADO, "Se requiere una identidad válida.");
  }
  if (!esEmpleador(contexto)) {
    // RN-13: el histórico es solo para el empleador.
    return errorResponse(
      403,
      NO_AUTORIZADO,
      "El rol empleada no puede consultar el histórico.",
    );
  }

  const params = new URL(request.url).searchParams;
  const parsed = rangoHistoricoSchema.safeParse({
    desde: params.get("desde"),
    hasta: params.get("hasta"),
  });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    const historico = await obtenerHistorico(
      contexto.empleadaId,
      parsed.data.desde,
      parsed.data.hasta,
    );
    return Response.json(historico, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/tareas/historico", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
