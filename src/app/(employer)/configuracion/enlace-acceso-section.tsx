"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/Dialog";
import { AccessLinkCard } from "@/components/domain/AccessLinkCard";

// Sección de /configuracion (Spec enlace-acceso). Genera/regenera, copia y revoca
// el enlace de acceso de solo lectura de la empleada por el cliente tipado. El
// contrato no expone un GET del enlace: la sección arranca sin enlace (revocado) y
// se genera bajo demanda. La revocación es destructiva ⇒ confirmación (Dialog).

type EnlaceAcceso = components["schemas"]["EnlaceAcceso"];

const ERROR_GENERAR = "No pudimos generar el enlace. Intenta de nuevo.";
const ERROR_REVOCAR = "No pudimos revocar el enlace. Intenta de nuevo.";
const ERROR_COPIAR = "No pudimos copiar el enlace.";

export function EnlaceAccesoSection() {
  const [enlace, setEnlace] = React.useState<EnlaceAcceso | null>(null);
  const [generando, setGenerando] = React.useState(false);
  const [revocando, setRevocando] = React.useState(false);
  const [confirmacionAbierta, setConfirmacionAbierta] = React.useState(false);

  const activo = Boolean(enlace?.activo);

  async function generar() {
    if (generando) {
      return;
    }
    setGenerando(true);
    try {
      const { data, error } = await apiClient.POST("/acceso/enlace");
      if (error || !data) {
        throw new Error("error al generar enlace");
      }
      setEnlace(data as EnlaceAcceso);
    } catch {
      toast.error(ERROR_GENERAR);
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    if (!enlace) {
      return;
    }
    try {
      await navigator.clipboard.writeText(enlace.url);
      toast.success("Enlace copiado.");
    } catch {
      toast.error(ERROR_COPIAR);
    }
  }

  async function confirmarRevocacion() {
    if (revocando) {
      return;
    }
    setRevocando(true);
    try {
      const { error } = await apiClient.DELETE("/acceso/enlace");
      if (error) {
        throw new Error("error al revocar enlace");
      }
      setEnlace((prev) => (prev ? { ...prev, activo: false } : prev));
      setConfirmacionAbierta(false);
      toast.success("Enlace revocado.");
    } catch {
      toast.error(ERROR_REVOCAR);
    } finally {
      setRevocando(false);
    }
  }

  return (
    <>
      <AccessLinkCard
        url={activo && enlace ? enlace.url : ""}
        activo={activo}
        onCopy={() => void copiar()}
        onRegenerate={() => void generar()}
        onRevoke={() => setConfirmacionAbierta(true)}
      />

      <Dialog open={confirmacionAbierta} onOpenChange={setConfirmacionAbierta}>
        <DialogContent>
          <DialogTitle>Revocar el enlace de acceso</DialogTitle>
          <DialogDescription>
            La empleada dejará de poder consultar su información con el enlace actual.
            Esta acción no se puede deshacer.
          </DialogDescription>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmacionAbierta(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={revocando}
              onClick={() => void confirmarRevocacion()}
            >
              Revocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
