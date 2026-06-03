// Estrategia de caché del service worker (Spec 1 — Epic 9.1, PWA offline).
// Función pura (conventions.md §3): clasifica una petición en la estrategia de
// caché que el SW debe aplicar para habilitar la consulta sin conexión de la
// empleada (BR-1). No accede a `caches`/`fetch`; solo decide.
//
// El service worker plano (public/sw.js) ESPEJA esta misma clasificación; este
// módulo es la versión testeada (el SW corre fuera del bundle y no se testea aquí).

export type CacheStrategy = "network-first" | "app-shell" | "network-only";

// Endpoints de consulta de SOLO LECTURA que la empleada necesita offline
// (obtenerMenu, obtenerTareasDelDia, obtenerRutinaTareas). Match EXACTO del
// pathname (ignorando query) para no capturar rutas del empleador con el mismo
// prefijo, p.ej. /api/v1/menu/configuracion (EC-1).
const CONSULTA_READ_PATHS = new Set<string>([
  "/api/v1/menu",
  "/api/v1/tareas/dia",
  "/api/v1/tareas/rutina",
]);

// Prefijo de la shell de consulta de la empleada (navegación a /consulta/<token>).
const CONSULTA_SHELL_PREFIX = "/consulta/";

interface InspectableRequest {
  method: string;
  url: string;
}

export function resolveCacheStrategy(
  request: InspectableRequest,
): CacheStrategy {
  // Solo se sirve desde caché lo que sea GET (BR-4); cualquier mutación va a red.
  const method = (request.method ?? "").toUpperCase();
  if (method !== "GET") {
    return "network-only";
  }

  // El pathname es lo único relevante; el query se ignora al clasificar (EC-2).
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    // URL vacía o no parseable: no arriesgar caché, ir a red (EC-4).
    return "network-only";
  }

  if (CONSULTA_READ_PATHS.has(pathname)) {
    return "network-first";
  }

  if (pathname.startsWith(CONSULTA_SHELL_PREFIX)) {
    return "app-shell";
  }

  return "network-only";
}
