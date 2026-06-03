import createClient from "openapi-fetch";
import type { paths } from "./schema";

// Cliente tipado ÚNICO de la UI hacia el backend (architecture.md §2.1).
// Tipado por los `paths` generados desde api-contract.openapi.yaml: la UI nunca
// escribe URLs a mano. El path proviene del contrato; aquí solo se fija el
// prefijo /api/v1 (servers del contrato). En este epic se genera el cliente; las
// páginas lo consumirán en el Milestone 8.

// openapi-fetch construye la URL con `new URL(path, baseUrl)`, que exige una
// base absoluta. En el navegador usamos el origin actual; en SSR/tests, un
// origin neutro. El path relativo del contrato se preserva intacto.
const ORIGIN =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";

export const API_BASE_URL = `${ORIGIN}/api/v1`;

// Resolvemos `fetch` en cada llamada (no al crear el cliente) para respetar el
// `fetch` vigente del entorno (navegador, Next runtime, o un mock en tests).
// openapi-fetch construye un `Request`; lo invocamos con la URL como primer
// argumento (legible/inspeccionable) y reconstruimos el init preservando
// método, headers y body.
//
// IMPORTANTE: el body se lee a un ArrayBuffer (bufferizado) en lugar de pasar
// `req.body` como stream con `duplex: "half"`. Un body en streaming obliga a
// Chrome a usar HTTP/2 (request streaming) y la negociación ALPN→h2 falla
// contra servidores HTTP/1.1 (ERR_ALPN_NEGOTIATION_FAILED). Bufferizar el body
// mantiene compatibilidad con HTTP/1.1 en navegadores reales.
export const dynamicFetch: typeof fetch = async (input, init) => {
  if (typeof Request !== "undefined" && input instanceof Request) {
    const req = input;
    const tieneBody = req.method !== "GET" && req.method !== "HEAD";
    const body = tieneBody ? await req.arrayBuffer() : undefined;
    // Serializamos los headers a un objeto plano. Mantener el `Headers` original
    // funciona en runtime, pero acopla a la realm de `Headers` del entorno (en
    // jsdom/undici la instancia puede no pasar `instanceof Headers` en otra realm);
    // un record plano es portable y preserva el header inyectado (X-Acceso-Token).
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const reqInit: RequestInit = {
      method: req.method,
      headers,
      body,
      credentials: req.credentials,
      signal: req.signal,
    };
    return globalThis.fetch(req.url, reqInit);
  }
  return globalThis.fetch(input, init);
};

// Alias para el cliente de consulta de la empleada (consulta-client.ts), que crea su
// propio cliente tipado con el mismo transporte bufferizado pero un middleware que
// añade el header X-Acceso-Token.
export const consultaFetch = dynamicFetch;

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: dynamicFetch,
});

export type ApiClient = typeof apiClient;
