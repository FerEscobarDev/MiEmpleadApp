"use client";

import * as React from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskChecklist, type TareaDelDia } from "@/components/domain/TaskChecklist";
import type { ConsultaClient } from "./consulta-client";

// Pestaña Tareas de la consulta de la empleada (Spec tareas-tab, HU-24/25, RN-13).
// obtenerTareasDelDia(hoy) (vía cliente de consulta con X-Acceso-Token) →
// TaskChecklist marcable; marcar conmuta de forma optimista y persiste vía
// marcarTarea (PUT /tareas/cumplimiento), revirtiendo en error. Es la ÚNICA
// escritura permitida a la empleada. Sin lógica de negocio (el backend valida).

const ERROR_CARGA = "No pudimos cargar las tareas del día. Intenta de nuevo.";
const ERROR_MARCAR = "No pudimos guardar el cambio. Intenta de nuevo.";

type Estado = "cargando" | "ok" | "error";

// Fecha local YYYY-MM-DD (sin desfase TZ por toISOString) — RN-17.
function fechaLocalISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export interface TareasTabProps {
  client: ConsultaClient;
  hoy?: Date;
}

export function TareasTab({ client, hoy = new Date() }: TareasTabProps) {
  const fecha = React.useMemo(() => fechaLocalISO(hoy), [hoy]);
  const [estado, setEstado] = React.useState<Estado>("cargando");
  const [tareas, setTareas] = React.useState<TareaDelDia[]>([]);

  React.useEffect(() => {
    let activo = true;
    setEstado("cargando");
    (async () => {
      const { data, error } = await client.GET("/tareas/dia", {
        params: { query: { fecha } },
      });
      if (!activo) return;
      if (error || !data) {
        setEstado("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setTareas(data as TareaDelDia[]);
      setEstado("ok");
    })();
    return () => {
      activo = false;
    };
  }, [client, fecha]);

  async function marcar(rutinaTareaId: string, hecha: boolean) {
    const previas = tareas;
    // Conmutación optimista inmediata.
    setTareas((prev) =>
      prev.map((t) => (t.rutinaTareaId === rutinaTareaId ? { ...t, hecha } : t)),
    );
    try {
      const { error, response } = await client.PUT("/tareas/cumplimiento", {
        body: { fecha, rutinaTareaId, hecha },
      });
      if (error || !response.ok) {
        throw new Error("error al marcar la tarea");
      }
    } catch {
      // Reversión + aviso.
      setTareas(previas);
      toast.error(ERROR_MARCAR);
    }
  }

  if (estado === "cargando") {
    return (
      <div className="flex flex-col gap-sm" aria-label="Cargando tareas del día">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>
    );
  }

  if (estado === "error") {
    return <p className="text-body text-error">{ERROR_CARGA}</p>;
  }

  if (tareas.length === 0) {
    return (
      <EmptyState
        title="No hay tareas"
        description="Hoy no tienes tareas en la rutina."
      />
    );
  }

  return (
    <TaskChecklist
      tareas={tareas}
      editable
      onToggle={(id, hecha) => void marcar(id, hecha)}
    />
  );
}
