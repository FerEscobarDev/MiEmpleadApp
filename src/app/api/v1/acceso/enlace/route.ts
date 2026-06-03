import { obtenerSesionEmpleador } from "@/features/auth/application/session-reader";
import { errorResponse } from "@/features/config/application/api-error";
import {
  generarEnlace,
  revocar,
} from "@/features/auth/application/acceso-service";

// Frontera HTTP del enlace de acceso de la empleada (architecture.md §2.2).
// Implementa generarEnlaceAcceso (POST) y revocarEnlaceAcceso (DELETE) del
// contrato. Ambas requieren sesión de empleador (RN-13); sin sesión ⇒ 401
// NO_AUTORIZADO. Sin lógica de negocio ni acceso directo a Prisma (conventions §4).

const NO_AUTORIZADO = "NO_AUTORIZADO";

// Deriva la base URL del enlace sin hardcodear dominio: usa la env pública si está
// definida; en su defecto, el origin de la petición entrante.
function resolverBaseUrl(request: Request): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.length > 0) {
    return envBase;
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionEmpleador();
  if (!sesion || !sesion.email) {
    return errorResponse(401, NO_AUTORIZADO, "Se requiere sesión de empleador.");
  }

  try {
    const enlace = await generarEnlace(sesion.email, resolverBaseUrl(request));
    return Response.json(enlace, { status: 200 });
  } catch (error) {
    console.error("Error en POST /api/v1/acceso/enlace", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}

export async function DELETE(_request: Request): Promise<Response> {
  void _request;
  const sesion = await obtenerSesionEmpleador();
  if (!sesion || !sesion.email) {
    return errorResponse(401, NO_AUTORIZADO, "Se requiere sesión de empleador.");
  }

  try {
    await revocar(sesion.email);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error en DELETE /api/v1/acceso/enlace", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
