import { getCurrentEmpleadaId } from "@/features/auth/current-empleada";
import { errorResponse } from "@/features/config/application/api-error";
import { obtenerMenu } from "@/features/menu/application/menu-service";

// Frontera HTTP del menú — lectura (architecture.md §2.2). Implementa obtenerMenu
// (GET) del contrato. Lectura permitida a ambos roles (empleador y empleada): no
// hay campo privado en el menú, así que no se aplica el strip de notas (RN-12 no
// aplica). Sin lógica de negocio ni acceso directo a Prisma (conventions.md §4).

// El parámetro request no se usa en la lectura (la empleada se resuelve por la
// costura de auth); se acepta por la firma estándar de los Route Handlers.
export async function GET(_request: Request): Promise<Response> {
  void _request;
  try {
    const empleadaId = await getCurrentEmpleadaId();
    const menu = await obtenerMenu(empleadaId);
    return Response.json(menu, { status: 200 });
  } catch (error) {
    console.error("Error en GET /api/v1/menu", error);
    return errorResponse(500, "ERROR_INTERNO", "Error interno.");
  }
}
