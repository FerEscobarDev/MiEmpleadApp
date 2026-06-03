import { resolverRol, rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { cerrarLiquidacionDelMes } from "@/features/liquidacion/application/liquidacion-service";

// Frontera HTTP del cierre de una liquidación (architecture.md §2.2). Implementa
// cerrarLiquidacion (POST) del contrato bajo /liquidaciones/{anio}/{mes}/cierre.
// Escritura solo del empleador (RN-13): guard rechazarSiNoEmpleador. Valida los
// segmentos del path, delega en la capa de aplicación (que congela los valores,
// RN-09) y serializa la respuesta o el envelope de error. Sin lógica de negocio ni
// acceso directo a Prisma (conventions.md §4).

const NO_AUTORIZADO = "NO_AUTORIZADO";
const MES_FUERA_DE_CONTRATO = "MES_FUERA_DE_CONTRATO";
const LIQUIDACION_CERRADA = "LIQUIDACION_CERRADA";

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

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  // RN-13: la empleada (token) no puede cerrar la liquidación.
  const rechazo = await rechazarSiNoEmpleador(request);
  if (rechazo) {
    return rechazo;
  }

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
    const result = await cerrarLiquidacionDelMes(
      contexto.empleadaId,
      parsed.anio,
      parsed.mes,
    );
    if (!result.ok) {
      if (result.error === "MES_FUERA_DE_CONTRATO") {
        return errorResponse(
          409,
          MES_FUERA_DE_CONTRATO,
          "El mes está fuera del periodo de contrato.",
        );
      }
      return errorResponse(
        409,
        LIQUIDACION_CERRADA,
        "La liquidación ya está cerrada.",
      );
    }
    return Response.json(result.liquidacion, { status: 200 });
  } catch (error) {
    console.error(
      "Error en POST /api/v1/liquidaciones/[anio]/[mes]/cierre",
      error,
    );
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
