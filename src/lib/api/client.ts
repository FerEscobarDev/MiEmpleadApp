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
// argumento (legible/inspeccionable) y el `Request` como init, preservando
// método, headers y body sin reconstruirlos a mano.
const dynamicFetch: typeof fetch = (input, init) => {
  if (typeof Request !== "undefined" && input instanceof Request) {
    const req = input;
    const reqInit: RequestInit = {
      method: req.method,
      headers: req.headers,
      body: req.body,
      credentials: req.credentials,
      signal: req.signal,
      ...(req.body ? { duplex: "half" } : {}),
    } as RequestInit;
    return globalThis.fetch(req.url, reqInit);
  }
  return globalThis.fetch(input, init);
};

export const apiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  fetch: dynamicFetch,
});

export type ApiClient = typeof apiClient;
