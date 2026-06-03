"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";

// Guard de rutas protegidas del empleador (spec employer-shell, RN-13). Consume la
// operación del contrato obtenerSesion a través del cliente tipado para decidir si
// hay una sesión autenticada. Sin sesión (o si la sonda falla) redirige a /login y
// NO renderiza el contenido protegido. La autorización real vive en el backend; este
// guard es la barrera de navegación del cliente, no la única defensa.

type EstadoSesion = "cargando" | "autenticado" | "no-autenticado";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = React.useState<EstadoSesion>("cargando");

  // El destino de redirección se accede por ref para que la sonda de sesión sea un
  // efecto de montaje único (deps []): así no se reejecuta —ni se reconsulta— ante
  // identidades inestables de `router` entre renders, que provocarían un bucle de
  // sondas y lecturas inconsistentes.
  const routerRef = React.useRef(router);
  routerRef.current = router;

  React.useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data, response } = await apiClient.GET("/auth/sesion");
        const autenticado = response.status === 200 && data?.autenticado === true;
        if (!activo) {
          return;
        }
        setEstado(autenticado ? "autenticado" : "no-autenticado");
        if (!autenticado) {
          routerRef.current.push("/login");
        }
      } catch {
        if (!activo) {
          return;
        }
        setEstado("no-autenticado");
        routerRef.current.push("/login");
      }
    })();
    return () => {
      activo = false;
    };
    // Efecto de montaje único: la sonda de sesión se ejecuta una sola vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (estado !== "autenticado") {
    // Mientras se verifica, o si no hay sesión, no se filtra el contenido protegido.
    return null;
  }

  return <>{children}</>;
}
