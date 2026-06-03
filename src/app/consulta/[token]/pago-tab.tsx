"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MonthCalendar } from "@/components/domain/MonthCalendar";
import { DesglosePanel } from "@/app/(employer)/liquidar/desglose-panel";
import type { components } from "@/lib/api/schema";
import type { ConsultaClient } from "./consulta-client";

// Pestaña Pago de la consulta de la empleada (Spec pago-menu-tabs, HU-15/16, RN-12).
// Selector de mes (actual por defecto) → obtenerLiquidacion (vía el cliente de
// consulta con X-Acceso-Token) → MonthCalendar en SOLO LECTURA (sin onSelectDay) +
// panel de desglose con el total en COP. NUNCA muestra notas (el backend ya las
// stripea para la empleada; además aquí no se renderiza el campo). Sin lógica de
// negocio: el cálculo vive en el backend.

type Liquidacion = components["schemas"]["Liquidacion"];
type DiaCalendario = components["schemas"]["DiaCalendario"];

const ERROR_CARGA = "No pudimos cargar el pago del mes. Intenta de nuevo.";

type Estado = "cargando" | "ok" | "sin-datos" | "error";

function codigoDeError(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export interface PagoTabProps {
  client: ConsultaClient;
  // La fecha de hoy se inyecta para testabilidad (conventions.md §3/§7).
  hoy?: Date;
}

// Valor del <input type="month"> ("YYYY-MM") → { anio, mes }.
function parseMes(valor: string): { anio: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  if (!m) return null;
  return { anio: Number(m[1]), mes: Number(m[2]) };
}

function mesActualISO(hoy: Date): string {
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export function PagoTab({ client, hoy = new Date() }: PagoTabProps) {
  const [periodo, setPeriodo] = React.useState<string>(() => mesActualISO(hoy));
  const [estado, setEstado] = React.useState<Estado>("cargando");
  const [liquidacion, setLiquidacion] = React.useState<Liquidacion | null>(null);

  const parsed = parseMes(periodo);
  const anio = parsed?.anio;
  const mes = parsed?.mes;

  React.useEffect(() => {
    if (anio === undefined || mes === undefined) {
      return;
    }
    let activo = true;
    setEstado("cargando");
    (async () => {
      const { data, error } = await client.GET("/liquidaciones/{anio}/{mes}", {
        params: { path: { anio, mes } },
      });
      if (!activo) return;
      if (error || !data) {
        setLiquidacion(null);
        if (codigoDeError(error) === "MES_FUERA_DE_CONTRATO") {
          setEstado("sin-datos");
          return;
        }
        setEstado("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setLiquidacion(data as Liquidacion);
      setEstado("ok");
    })();
    return () => {
      activo = false;
    };
  }, [client, anio, mes]);

  return (
    <div className="flex flex-col gap-lg">
      <div className="max-w-xs">
        <Input
          type="month"
          label="Mes"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        />
      </div>

      {estado === "cargando" ? (
        <div className="flex flex-col gap-md" aria-label="Cargando el pago del mes">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : estado === "error" ? (
        <p className="text-body text-error">{ERROR_CARGA}</p>
      ) : estado === "sin-datos" || !liquidacion ? (
        <EmptyState
          title="Sin datos para ese mes"
          description="Ese mes está fuera del periodo de contrato o aún no tiene información."
        />
      ) : (
        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader>
              <CardTitle>Calendario del mes</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthCalendar
                anio={liquidacion.anio}
                mes={liquidacion.mes}
                dias={(liquidacion.calendario ?? []) as DiaCalendario[]}
              />
            </CardContent>
          </Card>

          <DesglosePanel desglose={liquidacion.desglose} />
        </div>
      )}
    </div>
  );
}
