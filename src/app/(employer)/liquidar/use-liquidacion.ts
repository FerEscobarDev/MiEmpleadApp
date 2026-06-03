"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

// Hook de datos de /liquidar: carga la liquidación del periodo (obtenerLiquidacion) y
// el catálogo de items, y expone las acciones de novedades (actualizarLiquidacion) y de
// ciclo de vida (cerrarLiquidacion/reabrirLiquidacion). Toda la I/O pasa por el cliente
// tipado; NO hay lógica de negocio (cálculo/validación viven en el backend). Mapea los
// 409 de negocio a mensajes amables y conserva el estado previo ante fallos.

type Liquidacion = components["schemas"]["Liquidacion"];
type ItemAdicional = components["schemas"]["ItemAdicional"];
type ActualizarLiquidacionInput = components["schemas"]["ActualizarLiquidacionInput"];

export const ERROR_CARGA = "No pudimos cargar la liquidación. Intenta de nuevo.";
const ERROR_GUARDADO = "No pudimos guardar las novedades. Intenta de nuevo.";
const ERROR_CICLO = "No pudimos cambiar el estado de la liquidación. Intenta de nuevo.";
const MENSAJE_CONFLICTO_ESTADO =
  "El estado de la liquidación cambió. Recarga el mes e inténtalo de nuevo.";
const MENSAJE_INASISTENCIA_INVALIDA =
  "Esa fecha no admite inasistencia: solo días laborales, no festivos y dentro del contrato.";
const MENSAJE_LIQUIDACION_CERRADA =
  "El mes ya está cerrado. Reábrelo para poder editar las novedades.";

export type EstadoCarga = "cargando" | "ok" | "fuera-contrato" | "error";

// Lee el `code` de negocio del cuerpo de error del cliente tipado (envelope estándar
// { code, message }). openapi-fetch deja el cuerpo de error parseado en `error`.
function codigoDeError(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export interface UseLiquidacion {
  estadoCarga: EstadoCarga;
  liquidacion: Liquidacion | null;
  itemsCatalogo: ItemAdicional[];
  mensajeNovedad: string | null;
  editable: boolean;
  actualizar: (parcial: ActualizarLiquidacionInput) => Promise<void>;
  alternarInasistencia: (fecha: string) => void;
  cerrar: () => Promise<void>;
  reabrir: () => Promise<void>;
}

export function useLiquidacion(anio: number, mes: number): UseLiquidacion {
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [liquidacion, setLiquidacion] = React.useState<Liquidacion | null>(null);
  const [itemsCatalogo, setItemsCatalogo] = React.useState<ItemAdicional[]>([]);
  const [mensajeNovedad, setMensajeNovedad] = React.useState<string | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    setMensajeNovedad(null);
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

  // Catálogo de items activos para capturar cantidades en el panel de novedades.
  React.useEffect(() => {
    let activo = true;
    (async () => {
      const { data, error } = await apiClient.GET("/items-adicionales");
      if (!activo || error || !data) {
        return;
      }
      setItemsCatalogo((data as ItemAdicional[]).filter((i) => i.activo));
    })();
    return () => {
      activo = false;
    };
  }, []);

  const editable = liquidacion?.estado === "BORRADOR";

  const actualizar = React.useCallback(
    async (parcial: ActualizarLiquidacionInput): Promise<void> => {
      const actual = liquidacion;
      if (!actual) {
        return;
      }
      const body: ActualizarLiquidacionInput = {
        inasistencias: actual.inasistencias,
        items: actual.items.map((it) => ({ itemId: it.itemId, cantidad: it.cantidad })),
        montosPuntuales: actual.montosPuntuales.map((m) => ({
          descripcion: m.descripcion,
          monto: m.monto,
        })),
        notas: actual.notas ?? "",
        ...parcial,
      };
      const { data, error } = await apiClient.PUT("/liquidaciones/{anio}/{mes}", {
        params: { path: { anio: actual.anio, mes: actual.mes } },
        body,
      });
      if (error || !data) {
        const code = codigoDeError(error);
        if (code === "INASISTENCIA_INVALIDA") {
          setMensajeNovedad(MENSAJE_INASISTENCIA_INVALIDA);
          toast.error(MENSAJE_INASISTENCIA_INVALIDA);
        } else if (code === "LIQUIDACION_CERRADA") {
          setMensajeNovedad(MENSAJE_LIQUIDACION_CERRADA);
          toast.error(MENSAJE_LIQUIDACION_CERRADA);
        } else {
          toast.error(ERROR_GUARDADO);
        }
        return;
      }
      setMensajeNovedad(null);
      setLiquidacion(data as Liquidacion);
    },
    [liquidacion],
  );

  // Marca/desmarca una inasistencia para la fecha tocada en el calendario (RN-04).
  const alternarInasistencia = React.useCallback(
    (fecha: string): void => {
      if (!editable || !liquidacion) {
        return;
      }
      const yaEs = liquidacion.inasistencias.includes(fecha);
      const inasistencias = yaEs
        ? liquidacion.inasistencias.filter((f) => f !== fecha)
        : [...liquidacion.inasistencias, fecha];
      void actualizar({ inasistencias });
    },
    [editable, liquidacion, actualizar],
  );

  // Cierra o reabre la liquidación y refleja el nuevo estado devuelto por el backend
  // (badge + editabilidad). Un 409 indica conflicto de estado → mensaje amable.
  const cambiarEstado = React.useCallback(
    async (
      operacion: "/liquidaciones/{anio}/{mes}/cierre" | "/liquidaciones/{anio}/{mes}/reapertura",
      mensajeExito: string,
    ): Promise<void> => {
      if (!liquidacion) {
        return;
      }
      const { data, error } = await apiClient.POST(operacion, {
        params: { path: { anio: liquidacion.anio, mes: liquidacion.mes } },
      });
      if (error || !data) {
        toast.error(codigoDeError(error) ? MENSAJE_CONFLICTO_ESTADO : ERROR_CICLO);
        return;
      }
      setLiquidacion(data as Liquidacion);
      toast.success(mensajeExito);
    },
    [liquidacion],
  );

  const cerrar = React.useCallback(
    () => cambiarEstado("/liquidaciones/{anio}/{mes}/cierre", "Liquidación cerrada."),
    [cambiarEstado],
  );
  const reabrir = React.useCallback(
    () => cambiarEstado("/liquidaciones/{anio}/{mes}/reapertura", "Liquidación reabierta."),
    [cambiarEstado],
  );

  return {
    estadoCarga,
    liquidacion,
    itemsCatalogo,
    mensajeNovedad,
    editable: Boolean(editable),
    actualizar,
    alternarInasistencia,
    cerrar,
    reabrir,
  };
}
