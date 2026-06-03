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

// Contenido de diálogo de confirmación SIN el botón de cierre (X) del DialogContent
// compartido: en estos diálogos el único control de cierre es Cancelar/Confirmar, para
// que el nombre accesible "Cerrar" del X no colisione con las acciones de cierre.
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

// Acciones de ciclo de vida de /liquidar (Spec ciclo-vida). En BORRADOR ofrece
// "Cerrar liquidación"; en CERRADA ofrece "Reabrir". Cada acción se confirma con un
// Dialog (foco atrapado, Esc) que cita el mes/periodo afectado para no cerrar el mes
// equivocado (EC-2). La operación real (cerrarLiquidacion/reabrirLiquidacion) la
// ejecuta el contenedor por el cliente tipado; aquí solo se confirma la intención.

type EstadoLiquidacion = components["schemas"]["EstadoLiquidacion"];

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

export interface CicloVidaAccionesProps {
  estado: EstadoLiquidacion;
  anio: number;
  mes: number;
  onCerrar: () => void | Promise<void>;
  onReabrir: () => void | Promise<void>;
}

export function CicloVidaAcciones({
  estado,
  anio,
  mes,
  onCerrar,
  onReabrir,
}: CicloVidaAccionesProps) {
  const [confirmCierre, setConfirmCierre] = React.useState(false);
  const [confirmReapertura, setConfirmReapertura] = React.useState(false);
  const periodo = `${NOMBRE_MES[mes - 1] ?? mes} de ${anio}`;

  return (
    <div className="flex flex-wrap gap-md">
      {estado === "BORRADOR" ? (
        <Button variant="primary" onClick={() => setConfirmCierre(true)}>
          Cerrar liquidación
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => setConfirmReapertura(true)}>
          Reabrir
        </Button>
      )}

      <Dialog open={confirmCierre} onOpenChange={setConfirmCierre}>
        <ConfirmDialogContent>
          <DialogTitle>Cerrar liquidación</DialogTitle>
          <DialogDescription>
            Vas a cerrar la liquidación de {periodo}. Esto congela los valores y bloquea
            la edición; podrás reabrirla más adelante para corregir.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCierre(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmCierre(false);
                void onCerrar();
              }}
            >
              Confirmar cierre
            </Button>
          </DialogFooter>
        </ConfirmDialogContent>
      </Dialog>

      <Dialog open={confirmReapertura} onOpenChange={setConfirmReapertura}>
        <ConfirmDialogContent>
          <DialogTitle>Reabrir liquidación</DialogTitle>
          <DialogDescription>
            Vas a reabrir la liquidación de {periodo}. Volverá a borrador y podrás editar
            las novedades; tendrás que cerrarla de nuevo cuando termines.
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
              Confirmar reapertura
            </Button>
          </DialogFooter>
        </ConfirmDialogContent>
      </Dialog>
    </div>
  );
}
