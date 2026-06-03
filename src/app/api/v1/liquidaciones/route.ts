import { resolverRol } from "@/features/auth/authorize";
import { errorResponse } from "@/features/config/application/api-error";
import { listarResumenLiquidaciones } from "@/features/liquidacion/application/liquidacion-service";

// Frontera HTTP del historial de liquidaciones (architecture.md §2.2). Implementa
// listarLiquidaciones (GET) del contrato. La lectura está permitida a empleador y
// empleada (api-contract §1); resuelve el rol/empleada en la frontera y delega en
// la capa de aplicación. Sin lógica de negocio ni acceso directo a Prisma
// (conventions.md §4). El resumen no incluye notas (RN-12, trivial: el DTO no las
// tiene).

const NO_AUTORIZADO = "NO_AUTORIZADO";

export async function GET(request: Request): Promise<Response> {
  const contexto = await resolverRol(request);
  if (!contexto) {
    return errorResponse(401, NO_AUTORIZADO, "Identidad no válida.");
  }

  try {
    const resumenes = await listarResumenLiquidaciones(contexto.empleadaId);
    return Response.json(resumenes, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/liquidaciones", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
