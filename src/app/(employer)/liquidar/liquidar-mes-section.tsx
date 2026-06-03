"use client";

import * as React from "react";
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
import { NovedadesPanel } from "./novedades-panel";
import { CicloVidaAcciones } from "./ciclo-vida-acciones";
import { useLiquidacion, ERROR_CARGA } from "./use-liquidacion";

// Sección cliente de /liquidar. Selecciona mes/año y presenta lo que el hook
// useLiquidacion carga del backend (vía cliente tipado): calendario coloreado, panel
// de desglose destacado, badge de estado, novedades editables y acciones de cerrar/
// reabrir. Presentación pura: NO contiene lógica de negocio (cálculo, validación y
// congelamiento viven en el backend; RN-08, RN-16).

type ItemAdicional = components["schemas"]["ItemAdicional"];

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

const SELECT_CLASS =
  "h-11 rounded-md border border-border bg-surface px-md text-body text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface LiquidarMesSectionProps {
  anioInicial: number;
  mesInicial: number;
}

export function LiquidarMesSection({ anioInicial, mesInicial }: LiquidarMesSectionProps) {
  const [anio, setAnio] = React.useState(anioInicial);
  const [mes, setMes] = React.useState(mesInicial);
  const {
    estadoCarga,
    liquidacion,
    itemsCatalogo,
    mensajeNovedad,
    editable,
    actualizar,
    alternarInasistencia,
    cerrar,
    reabrir,
  } = useLiquidacion(anio, mes);

  const aniosDisponibles = React.useMemo(() => {
    const lista: number[] = [];
    for (let a = anioInicial - 5; a <= anioInicial + 1; a += 1) {
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
                className={SELECT_CLASS}
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
                className={SELECT_CLASS}
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
            <CardContent className="flex flex-col gap-md">
              <MonthCalendar
                anio={liquidacion.anio}
                mes={liquidacion.mes}
                dias={liquidacion.calendario as DiaCalendario[]}
                onSelectDay={editable ? alternarInasistencia : undefined}
              />
              {mensajeNovedad ? (
                <p role="alert" className="text-body text-error">
                  {mensajeNovedad}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <DesglosePanel desglose={liquidacion.desglose} />

          <CicloVidaAcciones
            estado={liquidacion.estado}
            anio={liquidacion.anio}
            mes={liquidacion.mes}
            onCerrar={cerrar}
            onReabrir={reabrir}
          />

          <NovedadesPanel
            itemsCatalogo={itemsCatalogo as ItemAdicional[]}
            itemsLiquidacion={liquidacion.items}
            montosPuntuales={liquidacion.montosPuntuales}
            notas={liquidacion.notas ?? ""}
            editable={editable}
            onGuardarItems={(items) => actualizar({ items })}
            onAgregarMonto={(descripcion, monto) =>
              actualizar({
                montosPuntuales: [
                  ...liquidacion.montosPuntuales.map((m) => ({
                    descripcion: m.descripcion,
                    monto: m.monto,
                  })),
                  { descripcion, monto },
                ],
              })
            }
            onGuardarNotas={(notas) => actualizar({ notas })}
          />
        </div>
      ) : null}
    </div>
  );
}
