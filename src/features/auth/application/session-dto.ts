// Traducción pura de la sesión de Auth.js al DTO del contrato `obtenerSesion`
// (api-contract: { autenticado: boolean, email?: string|null }). Sin IO. La sonda
// de sesión del layout del empleador usa autenticado:false cuando no hay sesión.

export interface SesionDto {
  autenticado: boolean;
  email?: string | null;
}

// Forma mínima de la sesión que nos interesa (subconjunto de la Session de Auth.js).
interface SesionLike {
  user?: { email?: string | null } | null;
}

export function mapSesionADto(session: SesionLike | null | undefined): SesionDto {
  if (!session || !session.user) {
    return { autenticado: false };
  }
  return { autenticado: true, email: session.user.email ?? null };
}
