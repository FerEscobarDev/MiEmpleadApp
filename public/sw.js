/*
 * Service Worker de MiEmpleadApp (Epic 9.1 — consulta offline / PWA).
 *
 * Habilita que la empleada consulte la ÚLTIMA info de menú y tareas aunque
 * quede sin conexión (business_requirements.md — "Consulta sin conexión").
 *
 * Estrategias (espejan src/lib/pwa/cache-strategy.ts, que es la versión testeada):
 *  - network-first : GET de los endpoints de consulta (obtenerMenu,
 *      obtenerTareasDelDia, obtenerRutinaTareas). Intenta red; si falla, sirve
 *      la última respuesta cacheada. Las respuestas OK se guardan en caché.
 *  - app-shell     : navegación a /consulta/<token> y assets del shell. Sirve
 *      la shell cacheada cuando la red no responde (stale-while-revalidate).
 *  - network-only  : todo lo demás (mutaciones como marcarTarea, rutas del
 *      empleador, otros métodos). NUNCA se cachea (RN-13: la empleada solo lee;
 *      no se reproducen escrituras offline).
 *
 * Se registra SOLO en producción (ver service-worker-registrar.tsx).
 */

const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `miempleadapp-runtime-${CACHE_VERSION}`;
const SHELL_CACHE = `miempleadapp-shell-${CACHE_VERSION}`;

// App shell mínima a precachear para arrancar offline.
const SHELL_ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png"];

const CONSULTA_READ_PATHS = new Set([
  "/api/v1/menu",
  "/api/v1/tareas/dia",
  "/api/v1/tareas/rutina",
]);
const CONSULTA_SHELL_PREFIX = "/consulta/";

function resolveCacheStrategy(request) {
  const method = (request.method || "").toUpperCase();
  if (method !== "GET") {
    return "network-only";
  }
  let pathname;
  try {
    pathname = new URL(request.url).pathname;
  } catch (_e) {
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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Limpia cachés de versiones anteriores y toma control de inmediato.
  const keep = new Set([RUNTIME_CACHE, SHELL_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// network-first: intenta la red; al fallar, sirve la última respuesta cacheada.
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_e) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw _e;
  }
}

// app-shell: stale-while-revalidate sobre la navegación/asset de la shell.
async function appShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const strategy = resolveCacheStrategy(event.request);
  if (strategy === "network-first") {
    event.respondWith(networkFirst(event.request));
  } else if (strategy === "app-shell") {
    event.respondWith(appShell(event.request));
  }
  // network-only: no respondWith → el navegador hace su fetch normal.
});
