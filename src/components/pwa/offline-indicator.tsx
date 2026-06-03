"use client";

import * as React from "react";

// Aviso de "sin conexión" para la consulta de la empleada (Epic 9.1).
// Cuando el navegador queda offline, el service worker sirve la última info de
// menú y tareas cacheada; este banner avisa que se está mostrando lo último
// guardado. Afordancia barata basada en navigator.onLine + eventos online/offline.
export function OfflineIndicator(): React.JSX.Element | null {
  // Arranca asumiendo online: en SSR no hay `navigator`, y mostrar el banner por
  // defecto sería un falso positivo. El estado real se resuelve al montar.
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    function sync(): void {
      setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md bg-warning/15 px-md py-sm text-caption text-foreground"
    >
      Estás sin conexión: mostrando la última información guardada.
    </div>
  );
}
