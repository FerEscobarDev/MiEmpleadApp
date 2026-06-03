import { db } from "@/lib/db";

// COSTURA DE AUTENTICACIÓN — Epic 3.1.
//
// TODO(Epic 4.2 — Acceso/Autenticación): reemplazar la resolución actual por la
// identidad real de la sesión del empleador (Auth.js) o del token de acceso de la
// empleada. La autorización por rol (RN-13: solo el empleador escribe) se aplicará
// en la frontera consumiendo esta identidad, SIN reescribir los Route Handlers de
// este epic. NO se implementa aquí ningún chequeo de rol: sería un falso control
// que los tests congelarían.
//
// Mientras tanto (app single-tenant por cuenta: una empleada por empleador, ver
// business_requirements + architecture.md §4), se resuelve la única empleada
// existente en la base. Esto es intencionalmente un placeholder.

export class EmpleadaNoResueltaError extends Error {
  constructor() {
    super("No hay una empleada registrada para resolver el contexto actual.");
    this.name = "EmpleadaNoResueltaError";
  }
}

export async function getCurrentEmpleadaId(): Promise<string> {
  const empleada = await db.empleada.findFirst({ select: { id: true } });
  if (!empleada) {
    throw new EmpleadaNoResueltaError();
  }
  return empleada.id;
}
