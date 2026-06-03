"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

// Hook compartido de datos de /menu (navigation_map.md §`/menu`, HU-20/21/22).
// Carga el menú vigente (obtenerMenu) y expone helpers de configuración/plantilla
// para las dos secciones de la página. Toda la I/O pasa por el cliente tipado; no
// hay lógica de negocio (los rangos de semana/comidas los valida el backend, Epic
// 6.1) — aquí solo se da forma a los datos para respetar el contrato y evitar 422s.

export type Periodicidad = components["schemas"]["Periodicidad"];
export type DiaSemana = components["schemas"]["DiaSemana"];
export type MenuConfig = components["schemas"]["MenuConfig"];
export type MenuEntrada = components["schemas"]["MenuEntrada"];
export type Menu = components["schemas"]["Menu"];

export const ERROR_CARGA_MENU = "No pudimos cargar el menú. Intenta de nuevo.";

export type EstadoCargaMenu = "cargando" | "ok" | "error";

// Número de semanas del ciclo según periodicidad (RN-14): función pura, sin DB.
export function semanasDePeriodicidad(periodicidad: Periodicidad): number {
  switch (periodicidad) {
    case "SEMANAL":
      return 1;
    case "QUINCENAL":
      return 2;
    case "MENSUAL":
      return 4;
    default:
      return 1;
  }
}

export interface UseMenu {
  estadoCarga: EstadoCargaMenu;
  menu: Menu | null;
}

// Carga base del menú; cada sección mantiene su propio estado editable derivado.
export function useMenu(): UseMenu {
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCargaMenu>("cargando");
  const [menu, setMenu] = React.useState<Menu | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/menu");
      if (!activo) {
        return;
      }
      if (error || !data) {
        setEstadoCarga("error");
        toast.error(ERROR_CARGA_MENU);
        return;
      }
      setMenu(data as Menu);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, []);

  return { estadoCarga, menu };
}
