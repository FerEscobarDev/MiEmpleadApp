import { obtenerSesionEmpleador } from "@/features/auth/application/session-reader";
import { buscarEmpleadorPorEmail } from "@/features/auth/data/empleador-repository";
import { buscarEmpleadaPorEmpleador } from "@/features/config/data/empleada-repository";
import { resolverEmpleadaPorToken } from "@/features/auth/application/acceso-service";
import { errorResponse } from "@/features/config/application/api-error";

// Capa de autorización por rol de la frontera (architecture.md §2.6 / §5.1 / §6).
// Resuelve el rol del llamador desde la sesión del empleador (Auth.js) o desde el
// token de la empleada (header X-Acceso-Token), y expone helpers para que los
// Route Handlers permitan lecturas a ambos roles, rechacen escrituras de la
// empleada (RN-13) y oculten las notas a la empleada (RN-12).

export type Rol = "EMPLEADOR" | "EMPLEADA";

export interface ContextoRol {
  rol: Rol;
  empleadaId: string;
}

const NO_AUTORIZADO = "NO_AUTORIZADO";
export const HEADER_ACCESO_TOKEN = "X-Acceso-Token";

// Resuelve el rol del llamador. Prioriza la sesión del empleador; si no hay sesión,
// intenta el token de la empleada. Devuelve null si no hay identidad válida.
export async function resolverRol(request: Request): Promise<ContextoRol | null> {
  const sesion = await obtenerSesionEmpleador();
  if (sesion && sesion.email) {
    const empleador = await buscarEmpleadorPorEmail(sesion.email);
    if (empleador) {
      const empleada = await buscarEmpleadaPorEmpleador(empleador.id);
      if (empleada) {
        return { rol: "EMPLEADOR", empleadaId: empleada.id };
      }
    }
  }

  const token = request.headers.get(HEADER_ACCESO_TOKEN);
  if (token) {
    const contexto = await resolverEmpleadaPorToken(token);
    if (contexto) {
      return { rol: "EMPLEADA", empleadaId: contexto.empleadaId };
    }
  }

  return null;
}

export function esEmpleador(contexto: ContextoRol): boolean {
  return contexto.rol === "EMPLEADOR";
}

// Solo el empleador puede escribir (RN-13). marcarTarea es la excepción y se maneja
// en su propio handler (Epic 6.2), no aquí.
export function puedeEscribir(contexto: ContextoRol): boolean {
  return contexto.rol === "EMPLEADOR";
}

// Oculta las notas (RN-12) para el rol empleada; las conserva para el empleador.
// Devuelve una copia (no muta el original).
export function stripNotas<T extends Record<string, unknown>>(
  objeto: T,
  rol: Rol,
): Omit<T, "notas"> | T {
  if (rol === "EMPLEADOR") {
    return { ...objeto };
  }
  const copia = { ...objeto };
  delete (copia as Record<string, unknown>).notas;
  return copia;
}

// Guard reutilizable para handlers de ESCRITURA: devuelve una Response 403 si el
// llamador presenta un token de empleada (rol empleada o token inválido) y NO es
// empleador; devuelve null si la escritura está permitida (empleador, o sin token
// de empleada presente — backward-compat con el flujo existente, BR-4).
export async function rechazarSiNoEmpleador(
  request: Request,
): Promise<Response | null> {
  const token = request.headers.get(HEADER_ACCESO_TOKEN);
  if (!token) {
    // Sin credencial de empleada: se preserva el flujo previo (sesión/fallback).
    return null;
  }

  // Hay un token de empleada presente: solo se permite si además hay sesión de
  // empleador. Si el rol resuelto no es empleador (empleada o token inválido), 403.
  const contexto = await resolverRol(request);
  if (contexto && esEmpleador(contexto)) {
    return null;
  }
  return errorResponse(
    403,
    NO_AUTORIZADO,
    "El rol empleada no puede realizar esta operación.",
  );
}
