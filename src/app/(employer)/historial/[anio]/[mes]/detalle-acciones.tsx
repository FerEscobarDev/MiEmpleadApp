"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/Dialog";

// Acciones administrativas del detalle del historial (Spec detalle-mes). "Eliminar"
// (RN-19/HU-19) y, solo si la liquidación está CERRADA, "Reabrir" (HU-14/RN-11). Cada
// acción se confirma con un Dialog (foco atrapado, Esc) que cita el periodo afectado.
// La operación real (eliminarLiquidacion/reabrirLiquidacion) la ejecuta el contenedor
// por el cliente tipado; aquí solo se confirma la intención.

type EstadoLiquidacion = components["schemas"]["EstadoLiquidacion"];

// Contenido de diálogo de confirmación SIN el botón de cierre (X): el único control de
// cierre son Cancelar/Confirmar, para que el nombre accesible "Cerrar" del X no colisione
// con las acciones del diálogo.
function ConfirmDialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-modal grid w-[calc(100%-2rem)] max-w-md " +
            "-translate-x-1/2 -translate-y-1/2 gap-md rounded-lg border border-border " +
            "bg-surface p-lg shadow-lg focus:outline-none data-[state=open]:animate-in " +
            "data-[state=closed]:animate-out motion-reduce:animate-none",
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

const NOMBRE_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export interface DetalleAccionesProps {
  estado: EstadoLiquidacion;
  anio: number;
  mes: number;
  onEliminar: () => void | Promise<void>;
  onReabrir: () => void | Promise<void>;
}

export function DetalleAcciones({
  estado,
  anio,
  mes,
  onEliminar,
  onReabrir,
}: DetalleAccionesProps) {
  const [confirmEliminar, setConfirmEliminar] = React.useState(false);
  const [confirmReapertura, setConfirmReapertura] = React.useState(false);
  const periodo = `${NOMBRE_MES[mes - 1] ?? mes} de ${anio}`;

  return (
    <div className="flex flex-wrap gap-md">
      {estado === "CERRADA" ? (
        <Button variant="secondary" onClick={() => setConfirmReapertura(true)}>
          Reabrir
        </Button>
      ) : null}

      <Button variant="danger" onClick={() => setConfirmEliminar(true)}>
        Eliminar
      </Button>

      <Dialog open={confirmEliminar} onOpenChange={setConfirmEliminar}>
        <ConfirmDialogContent>
          <DialogTitle>Eliminar liquidación</DialogTitle>
          <DialogDescription>
            Vas a eliminar la liquidación de {periodo}. Esta acción no se puede deshacer y
            el mes desaparecerá del historial.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmEliminar(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmEliminar(false);
                void onEliminar();
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </ConfirmDialogContent>
      </Dialog>

      <Dialog open={confirmReapertura} onOpenChange={setConfirmReapertura}>
        <ConfirmDialogContent>
          <DialogTitle>Reabrir liquidación</DialogTitle>
          <DialogDescription>
            Vas a reabrir la liquidación de {periodo}. Volverá a borrador y podrás editar
            las novedades en Liquidar; tendrás que cerrarla de nuevo cuando termines.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReapertura(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmReapertura(false);
                void onReabrir();
              }}
            >
              Reabrir
            </Button>
          </DialogFooter>
        </ConfirmDialogContent>
      </Dialog>
    </div>
  );
}
