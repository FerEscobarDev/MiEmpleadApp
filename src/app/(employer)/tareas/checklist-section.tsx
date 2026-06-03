"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskChecklist } from "@/components/domain/TaskChecklist";
import {
  ERROR_CARGA_DIA,
  fechaLocalISO,
  type EstadoCarga,
  type TareaDelDia,
} from "./use-tareas";

// Checklist del día de /tareas (Spec checklist-historico, HU-24/HU-25/RN-15).
// Selector de fecha (hoy por defecto) → obtenerTareasDelDia; marcar una tarea
// conmuta de forma optimista y persiste vía marcarTarea, revirtiendo en error.
// Reutiliza el componente de Design System TaskChecklist. La I/O pasa por el
// cliente tipado; sin lógica de negocio (el backend valida el cumplimiento).

const ERROR_MARCAR = "No pudimos guardar el cambio. Intenta de nuevo.";

export function ChecklistSection() {
  const [fecha, setFecha] = React.useState<string>(() => fechaLocalISO());
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [tareas, setTareas] = React.useState<TareaDelDia[]>([]);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/tareas/dia", {
        params: { query: { fecha } },
      });
      if (!activo) return;
      if (error || !data) {
        setEstadoCarga("error");
        toast.error(ERROR_CARGA_DIA);
        return;
      }
      setTareas(data as TareaDelDia[]);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, [fecha]);

  async function marcar(rutinaTareaId: string, hecha: boolean) {
    // AC-5: toggle optimista inmediato.
    const previas = tareas;
    setTareas((prev) =>
      prev.map((t) => (t.rutinaTareaId === rutinaTareaId ? { ...t, hecha } : t)),
    );
    try {
      const { error, response } = await apiClient.PUT("/tareas/cumplimiento", {
        body: { fecha, rutinaTareaId, hecha },
      });
      if (error || !response.ok) {
        throw new Error("error al marcar la tarea");
      }
    } catch {
      // AC-6: revertir al estado previo y avisar.
      setTareas(previas);
      toast.error(ERROR_MARCAR);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="max-w-xs">
        <Input
          type="date"
          label="Fecha"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {estadoCarga === "cargando" ? (
        <div className="flex flex-col gap-sm" aria-label="Cargando tareas del día">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : estadoCarga === "error" ? (
        <p className="text-body text-error">{ERROR_CARGA_DIA}</p>
      ) : tareas.length === 0 ? (
        <EmptyState
          title="No hay tareas"
          description="Esta fecha no tiene tareas en la rutina."
        />
      ) : (
        <TaskChecklist tareas={tareas} editable onToggle={(id, hecha) => void marcar(id, hecha)} />
      )}
    </div>
  );
}
