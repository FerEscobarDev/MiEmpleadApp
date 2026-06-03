"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import {
  useMenu,
  semanasDePeriodicidad,
  ERROR_CARGA_MENU,
  type MenuConfig,
  type Periodicidad,
} from "./use-menu";

// Sección de configuración de /menu (Spec configuracion-menu, HU-20/RN-19, HU-21/RN-14).
// Edita las comidas (agregar/renombrar/quitar) y la periodicidad, y persiste con
// actualizarConfiguracionMenu. Presentación pura: la I/O pasa por el cliente tipado;
// el mapeo periodicidad→semanas es un helper puro (no lógica de negocio sensible).

const ERROR_GUARDADO = "No pudimos guardar la configuración. Intenta de nuevo.";

const PERIODICIDADES: ReadonlyArray<{ valor: Periodicidad; etiqueta: string }> = [
  { valor: "SEMANAL", etiqueta: "Semanal" },
  { valor: "QUINCENAL", etiqueta: "Quincenal" },
  { valor: "MENSUAL", etiqueta: "Mensual" },
];

interface ComidaEditable {
  // Clave estable para el render (independiente del texto, que cambia al renombrar).
  key: string;
  nombre: string;
}

let contadorComida = 0;
function nuevaComida(nombre: string): ComidaEditable {
  contadorComida += 1;
  return { key: `comida-${contadorComida}`, nombre };
}

export function ConfiguracionMenuSection() {
  const { estadoCarga, menu } = useMenu();
  const [comidas, setComidas] = React.useState<ComidaEditable[]>([]);
  const [periodicidad, setPeriodicidad] = React.useState<Periodicidad>("SEMANAL");
  const [guardando, setGuardando] = React.useState(false);

  // Inicializa el estado editable cuando el menú termina de cargar.
  React.useEffect(() => {
    if (menu) {
      setComidas(menu.configuracion.comidas.map((c) => nuevaComida(c)));
      setPeriodicidad(menu.configuracion.periodicidad);
    }
  }, [menu]);

  function renombrarComida(key: string, nombre: string) {
    setComidas((prev) => prev.map((c) => (c.key === key ? { ...c, nombre } : c)));
  }

  function quitarComida(key: string) {
    setComidas((prev) => prev.filter((c) => c.key !== key));
  }

  function agregarComida() {
    setComidas((prev) => [...prev, nuevaComida("")]);
  }

  async function guardar() {
    if (guardando) {
      return;
    }
    setGuardando(true);
    try {
      const body: MenuConfig = {
        // Excluye comidas en blanco/espacios (EC-2); conserva el orden de edición.
        comidas: comidas.map((c) => c.nombre.trim()).filter((n) => n.length > 0),
        periodicidad,
      };
      const { error, response } = await apiClient.PUT("/menu/configuracion", { body });
      if (error || !response.ok) {
        throw new Error("error al guardar configuración del menú");
      }
      toast.success("Configuración del menú guardada.");
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardando(false);
    }
  }

  if (estadoCarga === "cargando") {
    return (
      <div className="flex flex-col gap-sm" aria-label="Cargando configuración del menú">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }

  if (estadoCarga === "error") {
    return <p className="text-body text-error">{ERROR_CARGA_MENU}</p>;
  }

  const semanas = semanasDePeriodicidad(periodicidad);

  return (
    <div className="flex flex-col gap-lg">
      {/* Comidas configurables (RN-19) */}
      <fieldset className="flex flex-col gap-sm">
        <legend className="text-body font-semibold text-foreground">Comidas</legend>
        <p className="text-caption text-foreground-muted">
          Define las comidas del día que componen el menú (ej. Desayuno, Almuerzo, Cena).
        </p>
        {comidas.map((c, i) => (
          <div key={c.key} className="flex items-end gap-sm">
            <div className="flex-1">
              <Input
                aria-label={`Comida ${i + 1}`}
                value={c.nombre}
                placeholder="Nombre de la comida"
                onChange={(e) => renombrarComida(c.key, e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="md"
              iconOnly
              aria-label={`Quitar ${c.nombre || `entrada ${i + 1}`}`}
              onClick={() => quitarComida(c.key)}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="secondary" onClick={agregarComida}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar comida
          </Button>
        </div>
      </fieldset>

      {/* Periodicidad (RN-14) — radiogroup accesible y testable */}
      <div
        role="radiogroup"
        aria-label="Periodicidad del menú"
        className="flex flex-col gap-sm"
      >
        <span className="text-body font-semibold text-foreground">Periodicidad</span>
        <div className="flex flex-wrap gap-sm">
          {PERIODICIDADES.map((p) => {
            const activa = periodicidad === p.valor;
            return (
              <button
                key={p.valor}
                type="button"
                role="radio"
                aria-checked={activa}
                onClick={() => setPeriodicidad(p.valor)}
                className={cn(
                  "min-h-[44px] rounded-md border px-lg py-sm text-body font-semibold " +
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
                    "focus-visible:ring-ring focus-visible:ring-offset-1 " +
                    "focus-visible:ring-offset-background motion-reduce:transition-none",
                  activa
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-foreground-muted hover:text-foreground",
                )}
              >
                {p.etiqueta}
              </button>
            );
          })}
        </div>
        <p className="text-caption text-foreground-muted">
          La plantilla se repite en {semanas} {semanas === 1 ? "semana" : "semanas"} del ciclo.
        </p>
      </div>

      <div>
        <Button type="button" onClick={() => void guardar()} loading={guardando}>
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}
