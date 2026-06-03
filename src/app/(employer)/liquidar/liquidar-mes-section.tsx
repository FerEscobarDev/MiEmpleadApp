"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { MonthCalendar, type DiaCalendario } from "@/components/domain/MonthCalendar";
import { Badge } from "@/components/ui/Badge";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { DesglosePanel } from "./desglose-panel";

// Sección cliente de /liquidar (Spec seleccion-y-desglose). Selecciona mes/año,
// carga la liquidación por el cliente tipado (obtenerLiquidacion) y renderiza el
// calendario coloreado, el panel de desglose y el badge de estado. NO contiene
// lógica de negocio: el cálculo y los tipos de día vienen del backend; la página
// solo presenta lo que devuelve el contrato (RN-08, RN-16). El registro de novedades
// y el ciclo de cerrar/reabrir se añaden en specs posteriores del mismo epic.

type Liquidacion = components["schemas"]["Liquidacion"];

const ERROR_CARGA = "No pudimos cargar la liquidación. Intenta de nuevo.";
const MENSAJE_FUERA_CONTRATO =
  "Este mes está fuera del periodo de contrato, por lo que no es liquidable.";

const MESES: ReadonlyArray<{ valor: number; etiqueta: string }> = [
  { valor: 1, etiqueta: "Enero" },
  { valor: 2, etiqueta: "Febrero" },
  { valor: 3, etiqueta: "Marzo" },
  { valor: 4, etiqueta: "Abril" },
  { valor: 5, etiqueta: "Mayo" },
  { valor: 6, etiqueta: "Junio" },
  { valor: 7, etiqueta: "Julio" },
  { valor: 8, etiqueta: "Agosto" },
  { valor: 9, etiqueta: "Septiembre" },
  { valor: 10, etiqueta: "Octubre" },
  { valor: 11, etiqueta: "Noviembre" },
  { valor: 12, etiqueta: "Diciembre" },
];

// Lee el `code` de negocio del cuerpo de error del cliente tipado (envelope estándar
// { code, message }). openapi-fetch deja el cuerpo de error parseado en `error`.
function codigoDeError(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export interface LiquidarMesSectionProps {
  anioInicial: number;
  mesInicial: number;
}

type EstadoCarga = "cargando" | "ok" | "fuera-contrato" | "error";

export function LiquidarMesSection({ anioInicial, mesInicial }: LiquidarMesSectionProps) {
  const [anio, setAnio] = React.useState(anioInicial);
  const [mes, setMes] = React.useState(mesInicial);
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [liquidacion, setLiquidacion] = React.useState<Liquidacion | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/liquidaciones/{anio}/{mes}", {
        params: { path: { anio, mes } },
      });
      if (!activo) {
        return;
      }
      if (error || !data) {
        if (codigoDeError(error) === "MES_FUERA_DE_CONTRATO") {
          setLiquidacion(null);
          setEstadoCarga("fuera-contrato");
          return;
        }
        setLiquidacion(null);
        setEstadoCarga("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setLiquidacion(data as Liquidacion);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, [anio, mes]);

  const aniosDisponibles = React.useMemo(() => {
    const base = anioInicial;
    const lista: number[] = [];
    for (let a = base - 5; a <= base + 1; a += 1) {
      lista.push(a);
    }
    if (!lista.includes(anio)) {
      lista.push(anio);
    }
    return lista.sort((a, b) => b - a);
  }, [anioInicial, anio]);

  return (
    <div className="flex flex-col gap-lg">
      <Card>
        <CardHeader>
          <CardTitle>Mes a liquidar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-md">
            <div className="flex flex-col gap-xs">
              <Label htmlFor="liquidar-mes">Mes</Label>
              <select
                id="liquidar-mes"
                className="h-11 rounded-md border border-border bg-surface px-md text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-xs">
              <Label htmlFor="liquidar-anio">Año</Label>
              <select
                id="liquidar-anio"
                className="h-11 rounded-md border border-border bg-surface px-md text-body text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
                {aniosDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            {liquidacion ? (
              <Badge
                variant={liquidacion.estado === "CERRADA" ? "success" : "neutral"}
                className="mb-1"
              >
                {liquidacion.estado === "CERRADA" ? "Cerrada" : "Borrador"}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {estadoCarga === "cargando" ? (
        <div className="flex flex-col gap-md" aria-label="Cargando liquidación">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : null}

      {estadoCarga === "fuera-contrato" ? (
        <Card>
          <CardContent className="py-lg text-body text-foreground-muted">
            {MENSAJE_FUERA_CONTRATO}
          </CardContent>
        </Card>
      ) : null}

      {estadoCarga === "error" ? (
        <Card>
          <CardContent className="py-lg text-body text-error">{ERROR_CARGA}</CardContent>
        </Card>
      ) : null}

      {estadoCarga === "ok" && liquidacion ? (
        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader>
              <CardTitle>Calendario del mes</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthCalendar
                anio={liquidacion.anio}
                mes={liquidacion.mes}
                dias={liquidacion.calendario as DiaCalendario[]}
              />
            </CardContent>
          </Card>

          <DesglosePanel desglose={liquidacion.desglose} />
        </div>
      ) : null}
    </div>
  );
}
