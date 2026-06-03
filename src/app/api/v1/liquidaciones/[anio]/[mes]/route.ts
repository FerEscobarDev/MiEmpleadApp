import { resolverRol, stripNotas } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { obtenerLiquidacionDelMes } from "@/features/liquidacion/application/liquidacion-service";

// Frontera HTTP de la liquidación de un mes (architecture.md §2.2). Implementa
// obtenerLiquidacion (GET) del contrato bajo /liquidaciones/{anio}/{mes}. Valida
// los segmentos del path, resuelve el rol (lectura para empleador y empleada),
// delega en la capa de aplicación y serializa la respuesta o el envelope de error.
// Para la empleada se omiten las notas (RN-12) vía stripNotas. Sin lógica de
// negocio ni acceso directo a Prisma (conventions.md §4).

const NO_AUTORIZADO = "NO_AUTORIZADO";
const MES_FUERA_DE_CONTRATO = "MES_FUERA_DE_CONTRATO";

interface RouteContext {
  params: Promise<{ anio: string; mes: string }>;
}

// Parsea y valida los segmentos del path a (anio, mes). anio entero; mes 1..12.
function parsearMes(
  anioRaw: string,
  mesRaw: string,
): { anio: number; mes: number } | null {
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);
  if (!Number.isInteger(anio) || !Number.isInteger(mes)) {
    return null;
  }
  if (mes < 1 || mes > 12) {
    return null;
  }
  return { anio, mes };
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const contexto = await resolverRol(request);
  if (!contexto) {
    return errorResponse(401, NO_AUTORIZADO, "Identidad no válida.");
  }

  const { anio: anioRaw, mes: mesRaw } = await context.params;
  const parsed = parsearMes(anioRaw, mesRaw);
  if (!parsed) {
    return validationErrorResponse({ anio: anioRaw, mes: mesRaw });
  }

  try {
    const result = await obtenerLiquidacionDelMes(
      contexto.empleadaId,
      parsed.anio,
      parsed.mes,
    );
    if (!result.ok) {
      return errorResponse(
        409,
        MES_FUERA_DE_CONTRATO,
        "El mes está fuera del periodo de contrato.",
      );
    }
    const cuerpo = stripNotas(result.liquidacion, contexto.rol);
    return Response.json(cuerpo, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/liquidaciones/[anio]/[mes]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
