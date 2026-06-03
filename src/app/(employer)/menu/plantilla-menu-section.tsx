"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { cn } from "@/lib/utils";
import {
  useMenu,
  semanasDePeriodicidad,
  ERROR_CARGA_MENU,
  type DiaSemana,
  type MenuEntrada,
} from "./use-menu";

// Sección plantilla de /menu (Spec plantilla-menu, HU-21/RN-14, HU-22).
// Tablero editable: una pestaña por semana del ciclo, filas = días L–D, columnas =
// comidas configuradas, celdas = descripción editable. Persiste con actualizarMenu
// enviando SOLO entradas válidas (semana en rango + comida configurada + no vacías),
// para que el backend (Epic 6.1) nunca devuelva 422. Realza el día de hoy (HU-22).

const ERROR_GUARDADO = "No pudimos guardar el menú. Intenta de nuevo.";

const DIAS: DiaSemana[] = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
  "DOMINGO",
];

const DIA_LABEL: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

// getDay() (0=Domingo) → DiaSemana. Permite inyectar la fecha para testabilidad.
const DIA_POR_INDICE: DiaSemana[] = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

function diaSemanaDeFecha(fecha: Date): DiaSemana {
  return DIA_POR_INDICE[fecha.getDay()];
}

// Clave de celda estable: semana|dia|comida.
function claveCelda(semana: number, dia: DiaSemana, comida: string): string {
  return `${semana}|${dia}|${comida}`;
}

export interface PlantillaMenuSectionProps {
  // El día de hoy se inyecta para testabilidad (conventions.md §3/§7: sin Date.now
  // oculto). En producción se deriva de la fecha actual.
  diaHoy?: DiaSemana;
}

export function PlantillaMenuSection({ diaHoy }: PlantillaMenuSectionProps) {
  const { estadoCarga, menu } = useMenu();
  // Descripciones editadas indexadas por clave de celda.
  const [valores, setValores] = React.useState<Record<string, string>>({});
  const [semanaActiva, setSemanaActiva] = React.useState(0);
  const [guardando, setGuardando] = React.useState(false);

  const comidas = React.useMemo(
    () => menu?.configuracion.comidas ?? [],
    [menu],
  );
  const periodicidad = menu?.configuracion.periodicidad ?? "SEMANAL";
  const semanas = semanasDePeriodicidad(periodicidad);

  // Inicializa los valores editables desde las entradas cargadas, de forma síncrona
  // en el primer render en que el menú está disponible (evita un paint intermedio con
  // celdas vacías). `seedRef` garantiza sembrar una sola vez por menú cargado.
  const seedRef = React.useRef<object | null>(null);
  if (menu && seedRef.current !== menu) {
    seedRef.current = menu;
    const inicial: Record<string, string> = {};
    for (const e of menu.entradas) {
      inicial[claveCelda(e.semana, e.diaSemana as DiaSemana, e.comida)] = e.descripcion;
    }
    // Sembrado durante el render: setState con el mismo valor es idempotente y React
    // reconcilia sin bucle (la condición seedRef impide re-sembrar).
    setValores(inicial);
  }

  const diaActual = diaHoy ?? diaSemanaDeFecha(new Date());

  function editarCelda(semana: number, dia: DiaSemana, comida: string, valor: string) {
    setValores((prev) => ({ ...prev, [claveCelda(semana, dia, comida)]: valor }));
  }

  async function guardar() {
    if (guardando) {
      return;
    }
    setGuardando(true);
    try {
      // Construye el set completo respetando el contrato (BR-4): solo semanas en
      // rango, solo comidas configuradas, descartando descripciones vacías. Así el
      // backend (Epic 6.1) nunca recibe combinaciones inválidas (no 422).
      const body: MenuEntrada[] = [];
      for (let semana = 0; semana < semanas; semana += 1) {
        for (const dia of DIAS) {
          for (const comida of comidas) {
            const descripcion = (valores[claveCelda(semana, dia, comida)] ?? "").trim();
            if (descripcion.length > 0) {
              body.push({ semana, diaSemana: dia, comida, descripcion });
            }
          }
        }
      }
      const { error, response } = await apiClient.PUT("/menu/entradas", { body });
      if (error || !response.ok) {
        throw new Error("error al guardar la plantilla del menú");
      }
      toast.success("Menú guardado.");
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardando(false);
    }
  }

  if (estadoCarga === "cargando") {
    return (
      <div className="flex flex-col gap-sm" aria-label="Cargando plantilla del menú">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (estadoCarga === "error") {
    return <p className="text-body text-error">{ERROR_CARGA_MENU}</p>;
  }

  if (comidas.length === 0) {
    return (
      <EmptyState
        title="Aún no hay comidas configuradas"
        description="Configura primero las comidas del menú (arriba) para definir la plantilla por día."
      />
    );
  }

  function tablero(semana: number) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Día</TableHead>
            {comidas.map((c) => (
              <TableHead scope="col" key={c}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {DIAS.map((dia) => {
            const esHoy = diaActual === dia;
            return (
              <TableRow
                key={dia}
                className={cn(esHoy && "bg-primary-soft")}
                aria-current={esHoy ? "date" : undefined}
              >
                <TableCell className="font-semibold">{DIA_LABEL[dia]}</TableCell>
                {comidas.map((comida) => (
                  <TableCell key={comida}>
                    <Input
                      aria-label={`${DIA_LABEL[dia]} — ${comida}`}
                      value={valores[claveCelda(semana, dia, comida)] ?? ""}
                      placeholder="—"
                      onChange={(e) => editarCelda(semana, dia, comida, e.target.value)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="text-caption text-foreground-muted">
        Define qué se prepara cada día. La fila resaltada es el día de hoy.
      </p>

      <Tabs
        value={String(semanaActiva)}
        onValueChange={(v) => setSemanaActiva(Number(v))}
      >
        <TabsList aria-label="Semana del ciclo">
          {Array.from({ length: semanas }, (_, i) => (
            <TabsTrigger key={i} value={String(i)}>
              Semana {i + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {Array.from({ length: semanas }, (_, i) => (
          <TabsContent key={i} value={String(i)} forceMount>
            <div hidden={semanaActiva !== i}>{tablero(i)}</div>
          </TabsContent>
        ))}
      </Tabs>

      <div>
        <Button type="button" onClick={() => void guardar()} loading={guardando}>
          Guardar menú
        </Button>
      </div>
    </div>
  );
}
