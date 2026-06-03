"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ERROR_CARGA_HISTORICO,
  fechaLocalISO,
  type CumplimientoTarea,
  type EstadoCarga,
} from "./use-tareas";

// Histórico de cumplimiento de /tareas (Spec checklist-historico, HU-26/RN-15).
// Selector de rango (desde/hasta) → obtenerHistoricoTareas; renderiza los
// cumplimientos agrupados por fecha indicando hecho/pendiente. La I/O pasa por el
// cliente tipado; sin lógica de negocio (el backend es la fuente de verdad).

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return fechaLocalISO(d);
}

interface GrupoFecha {
  fecha: string;
  items: CumplimientoTarea[];
}

function agruparPorFecha(items: CumplimientoTarea[]): GrupoFecha[] {
  const mapa = new Map<string, CumplimientoTarea[]>();
  for (const it of items) {
    const lista = mapa.get(it.fecha) ?? [];
    lista.push(it);
    mapa.set(it.fecha, lista);
  }
  return [...mapa.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, items]) => ({ fecha, items }));
}

export function HistoricoSection() {
  const [desde, setDesde] = React.useState<string>(() => hace30Dias());
  const [hasta, setHasta] = React.useState<string>(() => fechaLocalISO());
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [items, setItems] = React.useState<CumplimientoTarea[]>([]);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/tareas/historico", {
        params: { query: { desde, hasta } },
      });
      if (!activo) return;
      if (error || !data) {
        setEstadoCarga("error");
        toast.error(ERROR_CARGA_HISTORICO);
        return;
      }
      setItems(data as CumplimientoTarea[]);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  const grupos = agruparPorFecha(items);

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap gap-md">
        <Input
          type="date"
          label="Desde"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
        />
        <Input
          type="date"
          label="Hasta"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
        />
      </div>

      {estadoCarga === "cargando" ? (
        <div className="flex flex-col gap-sm" aria-label="Cargando histórico de tareas">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : estadoCarga === "error" ? (
        <p className="text-body text-error">{ERROR_CARGA_HISTORICO}</p>
      ) : grupos.length === 0 ? (
        <EmptyState
          title="No hay cumplimientos"
          description="Sin registros de tareas en el rango seleccionado."
        />
      ) : (
        <div className="flex flex-col gap-lg">
          {grupos.map((grupo) => (
            <section key={grupo.fecha} className="flex flex-col gap-sm">
              <h3 className="text-h3 font-semibold text-foreground tabular-nums">
                {grupo.fecha}
              </h3>
              <ul className="flex flex-col gap-xs">
                {grupo.items.map((it) => (
                  <li
                    key={`${it.fecha}-${it.rutinaTareaId}`}
                    className="flex items-center justify-between gap-sm"
                  >
                    <span className="text-body text-foreground">{it.descripcion}</span>
                    <Badge variant={it.hecha ? "success" : "neutral"}>
                      {it.hecha ? "Hecho" : "Pendiente"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
