import { buscarEmpleadorPorEmail } from "@/features/auth/data/empleador-repository";
import {
  buscarEmpleadaPorEmpleador,
  buscarEmpleadaPorId,
} from "@/features/config/data/empleada-repository";
import { generarTokenAcceso, hashTokenAcceso } from "@/features/auth/token";
import {
  guardarEnlace,
  revocarEnlace,
  buscarEnlaceActivoPorHash,
} from "@/features/auth/data/enlace-acceso-repository";

// Servicio de aplicación del acceso de la empleada (architecture.md §2.3 / §2.6).
// Orquesta el repositorio del enlace (§2.5) y el helper de token. Resuelve la
// empleada del empleador autenticado (para generar/revocar) y mapea token →
// empleada (para validar el acceso de la empleada y para la capa de autorización).

// DTO EnlaceAcceso del contrato (salida de la frontera).
export interface EnlaceAccesoDto {
  token: string;
  url: string;
  activo: boolean;
}

// Error de aplicación esperable: no hay empleada para el empleador de la sesión.
export class EmpleadaNoResueltaError extends Error {
  constructor() {
    super("No hay una empleada registrada para el empleador actual.");
    this.name = "EmpleadaNoResueltaError";
  }
}

// Resuelve la empleadaId del empleador autenticado por su email (sesión).
async function resolverEmpleadaDelEmpleador(email: string): Promise<string> {
  const empleador = await buscarEmpleadorPorEmail(email);
  if (!empleador) {
    throw new EmpleadaNoResueltaError();
  }
  const empleada = await buscarEmpleadaPorEmpleador(empleador.id);
  if (!empleada) {
    throw new EmpleadaNoResueltaError();
  }
  return empleada.id;
}

// Genera (o regenera) el enlace de la empleada del empleador autenticado. Devuelve
// el token EN CLARO (solo aquí se conoce); en la base se guarda su hash. La url se
// arma con la base provista por la frontera (sin hardcodear dominio).
export async function generarEnlace(
  email: string,
  baseUrl: string,
): Promise<EnlaceAccesoDto> {
  const empleadaId = await resolverEmpleadaDelEmpleador(email);
  const token = generarTokenAcceso();
  await guardarEnlace(empleadaId, hashTokenAcceso(token));
  return {
    token,
    url: construirUrlConsulta(baseUrl, token),
    activo: true,
  };
}

// Revoca el enlace de la empleada del empleador autenticado (idempotente).
export async function revocar(email: string): Promise<void> {
  const empleadaId = await resolverEmpleadaDelEmpleador(email);
  await revocarEnlace(empleadaId);
}

// Resuelve un token de empleada (en claro) a su contexto. Devuelve null si el
// token es inválido, inexistente o revocado. Usado por validarAccesoEmpleada y por
// la capa de autorización por rol.
export async function resolverEmpleadaPorToken(
  token: string,
): Promise<{ empleadaId: string; nombre: string } | null> {
  if (!token) {
    return null;
  }
  const enlace = await buscarEnlaceActivoPorHash(hashTokenAcceso(token));
  if (!enlace) {
    return null;
  }
  const empleada = await buscarEmpleadaPorId(enlace.empleadaId);
  if (!empleada) {
    return null;
  }
  return { empleadaId: empleada.id, nombre: empleada.nombre };
}

// Arma la url de consulta: <base>/consulta/<token>. La base no debe terminar en "/"
// duplicada.
function construirUrlConsulta(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/consulta/${token}`;
}
