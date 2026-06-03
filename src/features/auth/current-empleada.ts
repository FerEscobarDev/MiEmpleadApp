import {
  buscarPrimeraEmpleadaId,
  buscarEmpleadaPorEmpleador,
} from "@/features/config/data/empleada-repository";
import { buscarEmpleadorPorEmail } from "@/features/auth/data/empleador-repository";
import { obtenerSesionEmpleador } from "@/features/auth/application/session-reader";

// COSTURA DE AUTENTICACIÓN — Epic 4.1 (sesión del empleador).
//
// Resuelve la empleada del contexto actual. Si hay una sesión válida de empleador
// (Auth.js), resuelve la empleada DE ESE empleador a partir de su identidad
// (email → empleador → empleada). Si NO hay sesión (contexto de test sin cookie, o
// el acceso de la empleada por token aún no implementado — Epic 4.2), mantiene el
// fallback single-tenant a la única empleada de la cuenta, preservando el
// comportamiento que los Route Handlers de configuración (Epic 3.1/3.2) ya esperan.
//
// La autorización por rol (RN-13: solo el empleador escribe) NO se aplica aquí;
// se aplicará en la frontera consumiendo esta identidad en Epic 4.2. Aquí solo se
// establece la resolución de identidad.

export class EmpleadaNoResueltaError extends Error {
  constructor() {
    super("No hay una empleada registrada para resolver el contexto actual.");
    this.name = "EmpleadaNoResueltaError";
  }
}

export async function getCurrentEmpleadaId(): Promise<string> {
  const empleadaId = await resolverEmpleadaId();
  if (!empleadaId) {
    throw new EmpleadaNoResueltaError();
  }
  return empleadaId;
}

async function resolverEmpleadaId(): Promise<string | undefined> {
  const sesion = await obtenerSesionEmpleador();

  if (sesion && sesion.email) {
    // Con sesión: resolver la empleada del empleador autenticado. Si el empleador
    // no tiene empleada (no debería ocurrir tras el bootstrap), NO se cae al
    // fallback: se reporta no resuelta para no devolver la empleada de otra cuenta.
    const empleador = await buscarEmpleadorPorEmail(sesion.email);
    if (!empleador) {
      return undefined;
    }
    const empleada = await buscarEmpleadaPorEmpleador(empleador.id);
    return empleada?.id;
  }

  // Sin sesión: fallback single-tenant (backward-compat con los tests/endpoints
  // de configuración que corren sin cookie).
  return buscarPrimeraEmpleadaId();
}
