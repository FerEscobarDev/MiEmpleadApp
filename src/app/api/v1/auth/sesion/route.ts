import { obtenerSesionEmpleador } from "@/features/auth/application/session-reader";
import { mapSesionADto } from "@/features/auth/application/session-dto";
import { errorResponse } from "@/features/config/application/api-error";

// Frontera HTTP de obtenerSesion (GET /api/v1/auth/sesion). Sonda de sesión del
// layout del empleador: responde 200 { autenticado, email? } SIEMPRE (autenticado
// false cuando no hay sesión), no 401 (ver nota de reconciliación del spec).

export async function GET(): Promise<Response> {
  try {
    const sesion = await obtenerSesionEmpleador();
    // session-reader devuelve { email } o null; lo envolvemos en la forma que espera
    // mapSesionADto (user con email) para reutilizar la misma traducción pura.
    const dto = mapSesionADto(sesion ? { user: { email: sesion.email } } : null);
    return Response.json(dto, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/auth/sesion", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
