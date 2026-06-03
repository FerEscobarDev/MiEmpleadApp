import { resolverRol, rechazarSiNoEmpleador } from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import { reabrirLiquidacionDelMes } from "@/features/liquidacion/application/liquidacion-service";

// Frontera HTTP de la reapertura de una liquidación (architecture.md §2.2).
// Implementa reabrirLiquidacion (POST) del contrato bajo
// /liquidaciones/{anio}/{mes}/reapertura. Escritura solo del empleador (RN-13).
// Devuelve la liquidación a BORRADOR para corregirla (RN-11). Sin lógica de
// negocio ni acceso directo a Prisma (conventions.md §4).

const NO_AUTORIZADO = "NO_AUTORIZADO";
const MES_FUERA_DE_CONTRATO = "MES_FUERA_DE_CONTRATO";
const LIQUIDACION_BORRADOR = "LIQUIDACION_BORRADOR";

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
  // RN-13: la empleada (token) no puede reabrir la liquidación.
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
    const result = await reabrirLiquidacionDelMes(
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
        LIQUIDACION_BORRADOR,
        "La liquidación ya está en borrador.",
      );
    }
    return Response.json(result.liquidacion, { status: 200 });
  } catch (error) {
    console.error(
      "Error en POST /api/v1/liquidaciones/[anio]/[mes]/reapertura",
      error,
    );
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
