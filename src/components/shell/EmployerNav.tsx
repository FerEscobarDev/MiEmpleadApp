"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Settings,
  Calculator,
  History,
  UtensilsCrossed,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Navegación del empleador (navigation_map.md §Layout autenticado): las 6 secciones.
// Mobile-first: barra inferior en móvil, lateral en desktop (md+). Cada ítem es un
// enlace con ícono (aria-hidden) + etiqueta de texto, objetivo táctil ≥44px, foco
// visible y estado activo derivado de la ruta actual.

interface SeccionNav {
  nombre: string;
  ruta: string;
  Icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const SECCIONES: ReadonlyArray<SeccionNav> = [
  { nombre: "Inicio", ruta: "/", Icono: Home },
  { nombre: "Configuración", ruta: "/configuracion", Icono: Settings },
  { nombre: "Liquidar", ruta: "/liquidar", Icono: Calculator },
  { nombre: "Historial", ruta: "/historial", Icono: History },
  { nombre: "Menú", ruta: "/menu", Icono: UtensilsCrossed },
  { nombre: "Tareas", ruta: "/tareas", Icono: ListChecks },
];

function esActiva(rutaActual: string, ruta: string): boolean {
  if (ruta === "/") {
    return rutaActual === "/";
  }
  return rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);
}

export function EmployerNav() {
  const rutaActual = usePathname() ?? "/";

  return (
    <nav
      aria-label="Secciones del empleador"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[200] flex border-t border-border bg-surface",
        "md:static md:h-full md:w-56 md:flex-col md:border-r md:border-t-0 md:py-lg",
      )}
    >
      {SECCIONES.map(({ nombre, ruta, Icono }) => {
        const activa = esActiva(rutaActual, ruta);
        return (
          <Link
            key={ruta}
            href={ruta}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-xs px-sm py-sm",
              "text-caption font-medium transition-colors focus-visible:outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              "md:min-h-0 md:flex-none md:flex-row md:justify-start md:gap-sm md:px-lg md:py-sm md:text-body",
              activa
                ? "text-primary md:bg-primary-soft"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            <Icono className="size-5 shrink-0" aria-hidden={true} />
            <span>{nombre}</span>
          </Link>
        );
      })}
    </nav>
  );
}
