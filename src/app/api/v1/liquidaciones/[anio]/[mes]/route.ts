import {
  resolverRol,
  rechazarSiNoEmpleador,
  stripNotas,
} from "@/features/auth/authorize";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";
import {
  obtenerLiquidacionDelMes,
  actualizarLiquidacionDelMes,
  eliminarLiquidacionDelMes,
} from "@/features/liquidacion/application/liquidacion-service";
import { actualizarLiquidacionInputSchema } from "@/features/liquidacion/application/schemas";

// Frontera HTTP de la liquidación de un mes (architecture.md §2.2). Implementa
// obtenerLiquidacion (GET) del contrato bajo /liquidaciones/{anio}/{mes}. Valida
// los segmentos del path, resuelve el rol (lectura para empleador y empleada),
// delega en la capa de aplicación y serializa la respuesta o el envelope de error.
// Para la empleada se omiten las notas (RN-12) vía stripNotas. Sin lógica de
// negocio ni acceso directo a Prisma (conventions.md §4).

const NO_AUTORIZADO = "NO_AUTORIZADO";
const MES_FUERA_DE_CONTRATO = "MES_FUERA_DE_CONTRATO";
const LIQUIDACION_CERRADA = "LIQUIDACION_CERRADA";
const INASISTENCIA_INVALIDA = "INASISTENCIA_INVALIDA";
const LIQUIDACION_NO_ENCONTRADA = "LIQUIDACION_NO_ENCONTRADA";

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
    // stripNotas exige un Record indexable; el DTO se ensancha en el límite para
    // consumir el helper compartido de RN-12 sin alterar su firma (Epic 4.2).
    const cuerpo = stripNotas(
      result.liquidacion as unknown as Record<string, unknown>,
      contexto.rol,
    );
    return Response.json(cuerpo, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/liquidaciones/[anio]/[mes]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  // RN-13: la empleada (token) no puede actualizar la liquidación.
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationErrorResponse({ body: "JSON inválido." });
  }

  const parsedBody = actualizarLiquidacionInputSchema.safeParse(payload);
  if (!parsedBody.success) {
    return validationErrorResponse(parsedBody.error.issues);
  }

  try {
    const result = await actualizarLiquidacionDelMes(
      contexto.empleadaId,
      parsed.anio,
      parsed.mes,
      parsedBody.data,
    );
    if (!result.ok) {
      if (result.error === "MES_FUERA_DE_CONTRATO") {
        return errorResponse(
          409,
          MES_FUERA_DE_CONTRATO,
          "El mes está fuera del periodo de contrato.",
        );
      }
      if (result.error === "LIQUIDACION_CERRADA") {
        return errorResponse(
          409,
          LIQUIDACION_CERRADA,
          "La liquidación está cerrada y no puede editarse.",
        );
      }
      return errorResponse(
        409,
        INASISTENCIA_INVALIDA,
        "Alguna inasistencia no es válida (festivo, día no laboral o fuera de contrato).",
        { invalidas: result.invalidas },
      );
    }
    // El escritor es el empleador; las notas se devuelven íntegras.
    return Response.json(result.liquidacion, { status: 200 });
  } catch (error) {
    console.error("Error en PUT /api/v1/liquidaciones/[anio]/[mes]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  // RN-13: la empleada (token) no puede eliminar la liquidación.
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
    const result = await eliminarLiquidacionDelMes(
      contexto.empleadaId,
      parsed.anio,
      parsed.mes,
    );
    if (!result.ok) {
      return errorResponse(
        404,
        LIQUIDACION_NO_ENCONTRADA,
        "No existe una liquidación para ese mes.",
      );
    }
    // RN-19: eliminación exitosa, sin cuerpo (204). La confirmación es de la UI.
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error en DELETE /api/v1/liquidaciones/[anio]/[mes]", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
