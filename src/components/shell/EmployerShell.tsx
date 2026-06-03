"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmployerNav } from "./EmployerNav";

// Shell autenticado del empleador (navigation_map.md §Layout autenticado). Compone
// la navegación de 6 secciones, un encabezado con el menú de usuario ("Cerrar
// sesión") y el área de contenido. El cierre de sesión consume cerrarSesionEmpleador
// a través del cliente tipado y luego redirige a /login. Es idempotente y robusto:
// incluso si el logout falla, el destino seguro es /login (la cookie se invalida en
// el servidor).

export function EmployerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [cerrando, setCerrando] = React.useState(false);

  async function cerrarSesion() {
    if (cerrando) {
      return;
    }
    setCerrando(true);
    try {
      await apiClient.POST("/auth/logout");
    } catch {
      // Ignorado a propósito: el destino seguro es /login pase lo que pase.
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <EmployerNav />

      <div className="flex flex-1 flex-col md:min-h-screen">
        {/* Un único encabezado (con un solo control de cierre de sesión), adaptado
            de forma responsiva, para evitar controles duplicados en el árbol de
            accesibilidad. */}
        <header
          className={cn(
            "sticky top-0 z-[200] flex items-center justify-between gap-md",
            "border-b border-border bg-surface px-md py-sm md:px-lg md:py-md",
          )}
        >
          <span className="text-h3 font-semibold text-foreground md:text-h2">
            MiEmpleadApp
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={cerrarSesion}
            loading={cerrando}
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-4" aria-hidden={true} />
            <span>Cerrar sesión</span>
          </Button>
        </header>

        {/* pb para no quedar tapado por la barra inferior en móvil */}
        <main className="flex-1 p-md pb-24 md:p-lg md:pb-lg">{children}</main>
      </div>
    </div>
  );
}
