"use client";

import * as React from "react";
import type { components } from "@/lib/api/schema";
import { MonthCalendar, type DiaCalendario } from "@/components/domain/MonthCalendar";
import { CurrencyDisplay } from "@/components/domain/CurrencyDisplay";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { DesglosePanel } from "@/app/(employer)/liquidar/desglose-panel";
import { useDetalleMes, ERROR_CARGA } from "./use-detalle-mes";
import { DetalleAcciones } from "./detalle-acciones";

// Sección cliente de /historial/[anio]/[mes] (navigation_map.md §detalle; HU-18/19/14).
// Muestra el detalle de un mes histórico: desglose completo, calendario en modo LECTURA
// (sin selección de días, BR-5) y novedades del mes, más acciones de eliminar (con
// confirmación, RN-19) y reabrir (solo CERRADA). Presentación pura: NO calcula nada (el
// backend provee desglose/calendario). Toda la I/O pasa por el cliente tipado.

type MontoPuntual = components["schemas"]["MontoPuntual"];
type LiquidacionItem = components["schemas"]["LiquidacionItem"];

const MENSAJE_FUERA_CONTRATO =
  "Este mes está fuera del periodo de contrato, por lo que no es liquidable.";

export interface DetalleMesSectionProps {
  anio: number;
  mes: number;
}

export function DetalleMesSection({ anio, mes }: DetalleMesSectionProps) {
  const { estadoCarga, liquidacion, eliminar, reabrir } = useDetalleMes(anio, mes);

  if (estadoCarga === "cargando") {
    return (
      <div className="flex flex-col gap-md" aria-label="Cargando liquidación">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (estadoCarga === "fuera-contrato") {
    return (
      <Card>
        <CardContent className="py-lg text-body text-foreground-muted">
          {MENSAJE_FUERA_CONTRATO}
        </CardContent>
      </Card>
    );
  }

  if (estadoCarga === "error" || !liquidacion) {
    return (
      <Card>
        <CardContent className="py-lg text-body text-error">{ERROR_CARGA}</CardContent>
      </Card>
    );
  }

  const items = liquidacion.items as LiquidacionItem[];
  const montos = liquidacion.montosPuntuales as MontoPuntual[];

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center gap-md">
        <Badge variant={liquidacion.estado === "CERRADA" ? "success" : "neutral"}>
          {liquidacion.estado === "CERRADA" ? "Cerrada" : "Borrador"}
        </Badge>
      </div>

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

      {items.length > 0 || montos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Novedades del mes</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-md">
            {items.length > 0 ? (
              <section className="flex flex-col gap-sm" aria-label="Items adicionales">
                <h4 className="text-bodyStrong font-semibold text-foreground">
                  Items adicionales
                </h4>
                <ul className="flex flex-col gap-xs">
                  {items.map((it) => (
                    <li
                      key={it.itemId}
                      className="flex items-center justify-between gap-md text-body"
                    >
                      <span>
                        {it.nombre} × {it.cantidad}
                      </span>
                      <CurrencyDisplay amount={it.subtotal} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {montos.length > 0 ? (
              <section className="flex flex-col gap-sm" aria-label="Montos puntuales">
                <h4 className="text-bodyStrong font-semibold text-foreground">
                  Montos puntuales
                </h4>
                <ul className="flex flex-col gap-xs">
                  {montos.map((m, i) => (
                    <li
                      key={m.id ?? `${m.descripcion}-${i}`}
                      className="flex items-center justify-between gap-md text-body"
                    >
                      <span>{m.descripcion}</span>
                      <CurrencyDisplay amount={m.monto} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {liquidacion.notas ? (
        <Card>
          <CardHeader>
            <CardTitle>Notas (privadas)</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-body text-foreground">
            {liquidacion.notas}
          </CardContent>
        </Card>
      ) : null}

      <DetalleAcciones
        estado={liquidacion.estado}
        anio={liquidacion.anio}
        mes={liquidacion.mes}
        onEliminar={eliminar}
        onReabrir={reabrir}
      />
    </div>
  );
}
