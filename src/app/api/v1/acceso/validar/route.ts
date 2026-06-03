import { errorResponse } from "@/features/config/application/api-error";
import { resolverEmpleadaPorToken } from "@/features/auth/application/acceso-service";

// Frontera HTTP de la validación del acceso de la empleada (architecture.md §2.2).
// Implementa validarAccesoEmpleada (GET) del contrato. Lee el token del header
// X-Acceso-Token; si falta, es inválido o está revocado ⇒ 401 ACCESO_INVALIDO.
// En éxito devuelve el ContextoEmpleada { nombre, valido }.

const ACCESO_INVALIDO = "ACCESO_INVALIDO";

export async function GET(request: Request): Promise<Response> {
  const token = request.headers.get("X-Acceso-Token");
  if (!token) {
    return errorResponse(401, ACCESO_INVALIDO, "Token de acceso requerido.");
  }

  try {
    const contexto = await resolverEmpleadaPorToken(token);
    if (!contexto) {
      return errorResponse(401, ACCESO_INVALIDO, "Token de acceso inválido.");
    }
    return Response.json({ nombre: contexto.nombre, valido: true }, {
      status: 200,
    });
  } catch (error) {
    console.error("Error en GET /api/v1/acceso/validar", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
