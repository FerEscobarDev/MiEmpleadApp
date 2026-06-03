// Costura fina de lectura de la sesión del empleador. Aísla la llamada a `auth()`
// de Auth.js para que los handlers del contrato (obtenerSesion) y la costura de
// identidad (getCurrentEmpleadaId) dependan de esta función mockeable y no de la
// maquinaria de cookies (decisión de cobertura del spec auth-sesion-y-costura).
//
// El import de Auth.js (`@/features/auth/auth`) es PEREZOSO (dynamic import dentro
// de la función), no estático: así, importar este módulo —y por transitividad la
// costura getCurrentEmpleadaId que usan los Route Handlers de configuración— NO
// arrastra next-auth al grafo de módulos en tiempo de carga.
//
// Cualquier fallo al cargar o ejecutar `auth()` (p.ej. fuera de un contexto de
// petición, o entorno sin la maquinaria de Auth.js disponible) se interpreta como
// "no hay sesión" (retorna null), nunca como un error que tumbe la petición: las
// lecturas sin sesión deben degradar al fallback single-tenant, no fallar.

export interface SesionEmpleador {
  email: string | null;
}

// Retorna la sesión del empleador (con su email) o null si no hay sesión.
export async function obtenerSesionEmpleador(): Promise<SesionEmpleador | null> {
  try {
    const { auth } = await import("@/features/auth/auth");
    const session = await auth();
    if (!session || !session.user) {
      return null;
    }
    return { email: session.user.email ?? null };
  } catch {
    return null;
  }
}
