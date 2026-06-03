"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

// Hook de datos del detalle de un mes histórico (/historial/[anio]/[mes]). Carga la
// liquidación (obtenerLiquidacion) y expone las acciones administrativas: eliminar
// (eliminarLiquidacion → redirige a /historial; RN-19/HU-19) y reabrir
// (reabrirLiquidacion → vuelve a borrador; HU-14/RN-11). Toda la I/O pasa por el cliente
// tipado; NO hay lógica de negocio (el desglose/calendario los provee el backend).

type Liquidacion = components["schemas"]["Liquidacion"];

export const ERROR_CARGA = "No pudimos cargar la liquidación. Intenta de nuevo.";
const ERROR_ELIMINAR = "No pudimos eliminar la liquidación. Intenta de nuevo.";
const ERROR_REABRIR = "No pudimos reabrir la liquidación. Intenta de nuevo.";

// Lee el `code` de negocio del cuerpo de error del cliente tipado ({ code, message }).
function codigoDeError(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export type EstadoCarga = "cargando" | "ok" | "fuera-contrato" | "error";

export interface UseDetalleMes {
  estadoCarga: EstadoCarga;
  liquidacion: Liquidacion | null;
  eliminar: () => Promise<void>;
  reabrir: () => Promise<void>;
}

export function useDetalleMes(anio: number, mes: number): UseDetalleMes {
  const router = useRouter();
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [liquidacion, setLiquidacion] = React.useState<Liquidacion | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/liquidaciones/{anio}/{mes}", {
        params: { path: { anio, mes } },
      });
      if (!activo) {
        return;
      }
      if (error || !data) {
        setLiquidacion(null);
        if (codigoDeError(error) === "MES_FUERA_DE_CONTRATO") {
          setEstadoCarga("fuera-contrato");
          return;
        }
        setEstadoCarga("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setLiquidacion(data as Liquidacion);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, [anio, mes]);

  const eliminar = React.useCallback(async (): Promise<void> => {
    // El 204 no trae cuerpo: nos apoyamos en response.ok (no en `error`, que puede
    // quedar indefinido cuando el fallo tampoco trae cuerpo parseable).
    const { error, response } = await apiClient.DELETE("/liquidaciones/{anio}/{mes}", {
      params: { path: { anio, mes } },
    });
    if (error || !response.ok) {
      toast.error(ERROR_ELIMINAR);
      return;
    }
    toast.success("Liquidación eliminada.");
    router.push("/historial");
  }, [anio, mes, router]);

  const reabrir = React.useCallback(async (): Promise<void> => {
    const { data, error } = await apiClient.POST(
      "/liquidaciones/{anio}/{mes}/reapertura",
      { params: { path: { anio, mes } } },
    );
    if (error || !data) {
      toast.error(ERROR_REABRIR);
      return;
    }
    setLiquidacion(data as Liquidacion);
    toast.success("Liquidación reabierta.");
  }, [anio, mes]);

  return { estadoCarga, liquidacion, eliminar, reabrir };
}
