import createClient, { type Middleware } from "openapi-fetch";
import { API_BASE_URL, consultaFetch } from "@/lib/api/client";
import type { paths } from "@/lib/api/schema";

// Cliente de consulta de la empleada (architecture.md §2.1 / §2.6).
// La empleada se autentica por TOKEN (no por cookie de sesión): el contrato exige
// el header X-Acceso-Token (securityScheme accesoEmpleada). Construimos un cliente
// tipado dedicado (mismo baseUrl y mismo `fetch` bufferizado que el cliente global,
// reusados de @/lib/api/client) y le registramos un middleware que adjunta el header
// en CADA petición. Es el mecanismo robusto de openapi-fetch (onRequest opera sobre
// el Request final), sin escribir URLs a mano.
//
// Se expone como una factory por token para que el shell cree un cliente vivo durante
// la sesión de consulta y lo pase a cada pestaña (evita estado global mutable,
// conventions.md §4).

export const HEADER_ACCESO_TOKEN = "X-Acceso-Token";

export type ConsultaClient = ReturnType<typeof createConsultaClient>;

export function createConsultaClient(token: string) {
  const client = createClient<paths>({
    baseUrl: API_BASE_URL,
    fetch: consultaFetch,
  });

  const tokenMiddleware: Middleware = {
    onRequest({ request }) {
      request.headers.set(HEADER_ACCESO_TOKEN, token);
      return request;
    },
  };

  client.use(tokenMiddleware);
  return client;
}

// ¿Hoy es el cumpleaños de la empleada? (RN-20) — compara por mes y día, ignorando
// el año. Función pura: la fecha "hoy" se recibe como parámetro (sin Date.now
// oculto, conventions.md §3/§7). `fechaNacimiento` en formato ISO YYYY-MM-DD.
export function esCumpleanosHoy(
  fechaNacimiento: string | null | undefined,
  hoy: Date,
): boolean {
  if (!fechaNacimiento) {
    return false;
  }
  const partes = fechaNacimiento.split("-");
  if (partes.length < 3) {
    return false;
  }
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (!Number.isInteger(mes) || !Number.isInteger(dia)) {
    return false;
  }
  return hoy.getMonth() + 1 === mes && hoy.getDate() === dia;
}
