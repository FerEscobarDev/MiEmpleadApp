"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/Dialog";
import { ItemAdicionalEditor } from "@/components/domain/ItemAdicionalEditor";

// Sección de /configuracion (Spec items-adicionales). CRUD de items de pago
// adicional consumido por el cliente tipado. Presentación pura: el contenedor
// orquesta la UI (lista, editor, eliminación) y cablea las operaciones del
// contrato; no contiene lógica de negocio. Moneda en COP enteros (RN-16).

type ItemAdicional = components["schemas"]["ItemAdicional"];
type ItemAdicionalInput = components["schemas"]["ItemAdicionalInput"];

const ERROR_CARGA = "No pudimos cargar los items. Intenta de nuevo.";
const ERROR_GUARDADO = "No pudimos guardar el item. Intenta de nuevo.";
const ERROR_ELIMINAR = "No pudimos eliminar el item. Intenta de nuevo.";

interface EditorState {
  abierto: boolean;
  // `id` ausente ⇒ creación; presente ⇒ edición de ese item.
  id?: string;
  nombre: string;
  valorUnitario: string;
  activo: boolean;
}

const EDITOR_VACIO: EditorState = {
  abierto: false,
  nombre: "",
  valorUnitario: "",
  activo: true,
};

export function ItemsAdicionalesSection() {
  const [cargando, setCargando] = React.useState(true);
  const [errorCarga, setErrorCarga] = React.useState(false);
  const [items, setItems] = React.useState<ItemAdicional[]>([]);
  const [editor, setEditor] = React.useState<EditorState>(EDITOR_VACIO);
  const [guardando, setGuardando] = React.useState(false);

  const recargar = React.useCallback(async (): Promise<boolean> => {
    const { data, error } = await apiClient.GET("/items-adicionales");
    if (error || !data) {
      return false;
    }
    setItems(data as ItemAdicional[]);
    return true;
  }, []);

  React.useEffect(() => {
    let activo = true;
    (async () => {
      const ok = await recargar();
      if (!activo) {
        return;
      }
      if (!ok) {
        setErrorCarga(true);
        toast.error(ERROR_CARGA);
      }
      setCargando(false);
    })();
    return () => {
      activo = false;
    };
  }, [recargar]);

  function abrirCreacion() {
    setEditor({ ...EDITOR_VACIO, abierto: true });
  }

  function abrirEdicion(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) {
      return;
    }
    setEditor({
      abierto: true,
      id: item.id,
      nombre: item.nombre,
      valorUnitario: String(item.valorUnitario),
      activo: item.activo,
    });
  }

  function cerrarEditor() {
    setEditor(EDITOR_VACIO);
  }

  async function guardar() {
    if (guardando) {
      return;
    }
    setGuardando(true);
    try {
      const body: ItemAdicionalInput = {
        nombre: editor.nombre,
        valorUnitario: Number(editor.valorUnitario),
        activo: editor.activo,
      };
      const respuesta = editor.id
        ? await apiClient.PUT("/items-adicionales/{id}", {
            params: { path: { id: editor.id } },
            body,
          })
        : await apiClient.POST("/items-adicionales", { body });
      if (respuesta.error) {
        throw new Error("error al guardar item");
      }
      toast.success("Item guardado.");
      cerrarEditor();
      await recargar();
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    try {
      const { error } = await apiClient.DELETE("/items-adicionales/{id}", {
        params: { path: { id } },
      });
      if (error) {
        throw new Error("error al eliminar item");
      }
      toast.success("Item eliminado.");
      await recargar();
    } catch {
      toast.error(ERROR_ELIMINAR);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-sm" aria-label="Cargando items">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (errorCarga) {
    return <p className="text-body text-error">{ERROR_CARGA}</p>;
  }

  return (
    <div className="flex flex-col gap-md">
      {items.length === 0 ? (
        <EmptyState
          title="No hay items adicionales"
          description="Crea conceptos de pago adicional como noches de acompañamiento u horas extra."
          action={
            <Button onClick={abrirCreacion}>
              <Plus className="size-4" aria-hidden="true" />
              Agregar item
            </Button>
          }
        />
      ) : (
        <ItemAdicionalEditor
          items={items}
          onCreate={abrirCreacion}
          onEdit={abrirEdicion}
          onDelete={(id) => void eliminar(id)}
        />
      )}

      <Dialog open={editor.abierto} onOpenChange={(o) => (o ? null : cerrarEditor())}>
        <DialogContent>
          <DialogTitle>{editor.id ? "Editar item" : "Nuevo item"}</DialogTitle>
          <DialogDescription>
            Define el nombre y el valor unitario en pesos del concepto de pago adicional.
          </DialogDescription>
          <form
            className="flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <Input
              id="item-nombre"
              label="Nombre"
              value={editor.nombre}
              onChange={(e) => setEditor((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <Input
              id="item-valor"
              type="number"
              inputMode="numeric"
              currency
              label="Valor unitario (COP)"
              value={editor.valorUnitario}
              onChange={(e) =>
                setEditor((prev) => ({ ...prev, valorUnitario: e.target.value }))
              }
            />
            <div className="flex items-center justify-between gap-md">
              <Label htmlFor="item-activo">Activo</Label>
              <Switch
                id="item-activo"
                aria-label="Activo"
                checked={editor.activo}
                onCheckedChange={(v) => setEditor((prev) => ({ ...prev, activo: v }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cerrarEditor}>
                Cancelar
              </Button>
              <Button type="submit" loading={guardando}>
                {editor.id ? "Guardar item" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
