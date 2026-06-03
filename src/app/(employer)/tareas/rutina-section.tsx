"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DIAS_SEMANA,
  ERROR_CARGA_RUTINA,
  esRangoHorarioValido,
  type DiaSemana,
  type EstadoCarga,
  type RutinaTarea,
  type RutinaTareaInput,
} from "./use-tareas";

// Editor de rutina de /tareas (Spec rutina-editor, HU-23/RN-15). Carga la rutina
// (obtenerRutinaTareas), la agrupa por día de la semana y permite editar/agregar/
// eliminar/reordenar tareas con horario opcional, guardando el conjunto completo
// (reemplazo total) vía actualizarRutinaTareas. Presentación pura: la I/O pasa por
// el cliente tipado; la validación HH:mm es de entrada (evita 422), no de negocio.

const ERROR_GUARDADO = "No pudimos guardar la rutina. Intenta de nuevo.";
const ERROR_HORARIO = "Revisa los horarios: usa HH:mm y que la hora de inicio no sea posterior a la de fin.";

interface TareaEditable {
  // Clave estable para el render (independiente del contenido editable).
  key: string;
  descripcion: string;
  horaInicio: string;
  horaFin: string;
}

let contador = 0;
function nuevaTarea(descripcion = "", horaInicio = "", horaFin = ""): TareaEditable {
  contador += 1;
  return { key: `tarea-${contador}`, descripcion, horaInicio, horaFin };
}

type PorDia = Record<DiaSemana, TareaEditable[]>;

function rutinaVacia(): PorDia {
  return DIAS_SEMANA.reduce((acc, d) => {
    acc[d.valor] = [];
    return acc;
  }, {} as PorDia);
}

function agruparRutina(rutina: RutinaTarea[]): PorDia {
  const porDia = rutinaVacia();
  for (const dia of DIAS_SEMANA) {
    porDia[dia.valor] = rutina
      .filter((t) => t.diaSemana === dia.valor)
      .sort((a, b) => a.orden - b.orden)
      .map((t) => nuevaTarea(t.descripcion, t.horaInicio ?? "", t.horaFin ?? ""));
  }
  return porDia;
}

export function RutinaSection() {
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [porDia, setPorDia] = React.useState<PorDia>(rutinaVacia);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/tareas/rutina");
      if (!activo) return;
      if (error || !data) {
        setEstadoCarga("error");
        toast.error(ERROR_CARGA_RUTINA);
        return;
      }
      setPorDia(agruparRutina(data as RutinaTarea[]));
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, []);

  function actualizarDia(dia: DiaSemana, fn: (tareas: TareaEditable[]) => TareaEditable[]) {
    setPorDia((prev) => ({ ...prev, [dia]: fn(prev[dia]) }));
  }

  function editarCampo(
    dia: DiaSemana,
    key: string,
    campo: "descripcion" | "horaInicio" | "horaFin",
    valor: string,
  ) {
    actualizarDia(dia, (tareas) =>
      tareas.map((t) => (t.key === key ? { ...t, [campo]: valor } : t)),
    );
  }

  function agregarTarea(dia: DiaSemana) {
    actualizarDia(dia, (tareas) => [...tareas, nuevaTarea()]);
  }

  function eliminarTarea(dia: DiaSemana, key: string) {
    actualizarDia(dia, (tareas) => tareas.filter((t) => t.key !== key));
  }

  function moverTarea(dia: DiaSemana, key: string, delta: -1 | 1) {
    actualizarDia(dia, (tareas) => {
      const i = tareas.findIndex((t) => t.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= tareas.length) return tareas;
      const copia = [...tareas];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });
  }

  function construirBody(): RutinaTareaInput[] | null {
    const body: RutinaTareaInput[] = [];
    for (const dia of DIAS_SEMANA) {
      let orden = 0;
      for (const t of porDia[dia.valor]) {
        const descripcion = t.descripcion.trim();
        // EC-2: tareas sin descripción no se persisten.
        if (descripcion.length === 0) continue;
        const horaInicio = t.horaInicio.trim() || undefined;
        const horaFin = t.horaFin.trim() || undefined;
        // AC-10: validación de horario (evita 422).
        if (!esRangoHorarioValido(horaInicio, horaFin)) return null;
        const item: RutinaTareaInput = { diaSemana: dia.valor, descripcion, orden };
        if (horaInicio) item.horaInicio = horaInicio;
        if (horaFin) item.horaFin = horaFin;
        body.push(item);
        orden += 1;
      }
    }
    return body;
  }

  async function guardar() {
    if (guardando) return;
    const body = construirBody();
    if (body === null) {
      toast.error(ERROR_HORARIO);
      return;
    }
    setGuardando(true);
    try {
      const { error, response } = await apiClient.PUT("/tareas/rutina", { body });
      if (error || !response.ok) {
        throw new Error("error al guardar la rutina");
      }
      toast.success("Rutina guardada.");
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardando(false);
    }
  }

  if (estadoCarga === "cargando") {
    return (
      <div className="flex flex-col gap-sm" aria-label="Cargando rutina de tareas">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    );
  }

  if (estadoCarga === "error") {
    return <p className="text-body text-error">{ERROR_CARGA_RUTINA}</p>;
  }

  return (
    <div className="flex flex-col gap-xl">
      {DIAS_SEMANA.map((dia) => {
        const tareas = porDia[dia.valor];
        return (
          <section
            key={dia.valor}
            role="group"
            aria-label={dia.etiqueta}
            className="flex flex-col gap-sm"
          >
            <h3 className="text-h3 font-semibold text-foreground">{dia.etiqueta}</h3>
            {tareas.length === 0 ? (
              <EmptyState
                title="Sin tareas"
                description={`No hay tareas para el ${dia.etiqueta.toLowerCase()}.`}
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => agregarTarea(dia.valor)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Agregar tarea
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col gap-md">
                {tareas.map((t, i) => {
                  const nombre = t.descripcion || `tarea ${i + 1}`;
                  return (
                    <li
                      key={t.key}
                      className="flex flex-col gap-sm rounded-md border border-border p-md sm:flex-row sm:items-end"
                    >
                      <div className="flex-1">
                        <Input
                          aria-label={`Descripción de la tarea ${i + 1} (${dia.etiqueta})`}
                          value={t.descripcion}
                          placeholder="Descripción de la tarea"
                          onChange={(e) =>
                            editarCampo(dia.valor, t.key, "descripcion", e.target.value)
                          }
                        />
                      </div>
                      <Input
                        type="time"
                        aria-label={`Hora inicio de ${nombre} (${dia.etiqueta})`}
                        value={t.horaInicio}
                        className="sm:w-32"
                        onChange={(e) =>
                          editarCampo(dia.valor, t.key, "horaInicio", e.target.value)
                        }
                      />
                      <Input
                        type="time"
                        aria-label={`Hora fin de ${nombre} (${dia.etiqueta})`}
                        value={t.horaFin}
                        className="sm:w-32"
                        onChange={(e) =>
                          editarCampo(dia.valor, t.key, "horaFin", e.target.value)
                        }
                      />
                      <div className="flex items-center gap-xs">
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          iconOnly
                          aria-label={`Subir ${nombre}`}
                          disabled={i === 0}
                          onClick={() => moverTarea(dia.valor, t.key, -1)}
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          iconOnly
                          aria-label={`Bajar ${nombre}`}
                          disabled={i === tareas.length - 1}
                          onClick={() => moverTarea(dia.valor, t.key, 1)}
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          iconOnly
                          aria-label={`Eliminar ${nombre}`}
                          onClick={() => eliminarTarea(dia.valor, t.key)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
                <li>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => agregarTarea(dia.valor)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Agregar tarea
                  </Button>
                </li>
              </ul>
            )}
          </section>
        );
      })}

      <div>
        <Button type="button" onClick={() => void guardar()} loading={guardando}>
          Guardar rutina
        </Button>
      </div>
    </div>
  );
}
