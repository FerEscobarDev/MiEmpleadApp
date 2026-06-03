import { signOut } from "@/features/auth/auth";
import { errorResponse } from "@/features/config/application/api-error";

// Frontera HTTP de cerrarSesionEmpleador (POST /api/v1/auth/logout). Handler
// delgado que envuelve el sign-out de Auth.js. Responde 204 y es idempotente
// (sin sesión también 204).

// Acepta el Request estándar de los Route Handlers (Next exige el primer
// parámetro no opcional); el cuerpo no se usa.
export async function POST(_request: Request): Promise<Response> {
  void _request;
  try {
    await signOut({ redirect: false });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Error en POST /api/v1/auth/logout", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
