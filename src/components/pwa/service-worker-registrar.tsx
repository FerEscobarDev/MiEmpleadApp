"use client";

import { useEffect } from "react";

// Registra el service worker (/sw.js) SOLO en producción (Epic 9.1, BR-3).
// En desarrollo no se registra para evitar servir assets obsoletos desde caché
// durante el hot-reload. Componente sin UI: monta un efecto y no renderiza nada.
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // El registro es best-effort: un fallo del SW nunca debe tumbar la app.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencioso: la app funciona igual online sin SW.
    });
  }, []);

  return null;
}
