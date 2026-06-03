"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { CurrencyDisplay } from "@/components/domain/CurrencyDisplay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Card, CardContent } from "@/components/ui/Card";

// Sección cliente de /historial (navigation_map.md §`/historial`, HU-17). Lista los
// meses registrados (listarLiquidaciones) ordenados de más reciente a más antiguo, con
// estado (Badge) y total (CurrencyDisplay), y enlaza cada fila a su detalle. Presentación
// pura: NO calcula nada (el total lo provee el backend; RN-16). Toda la I/O pasa por el
// cliente tipado; nunca URLs a mano.

type LiquidacionResumen = components["schemas"]["LiquidacionResumen"];

const ERROR_CARGA = "No pudimos cargar el historial. Intenta de nuevo.";

const NOMBRE_MES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function etiquetaPeriodo(anio: number, mes: number): string {
  return `${NOMBRE_MES[mes - 1] ?? mes} ${anio}`;
}

type EstadoCarga = "cargando" | "ok" | "error";

export function HistorialSection() {
  const [estadoCarga, setEstadoCarga] = React.useState<EstadoCarga>("cargando");
  const [meses, setMeses] = React.useState<LiquidacionResumen[]>([]);

  React.useEffect(() => {
    let activo = true;
    setEstadoCarga("cargando");
    (async () => {
      const { data, error } = await apiClient.GET("/liquidaciones");
      if (!activo) {
        return;
      }
      if (error || !data) {
        setEstadoCarga("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setMeses(data as LiquidacionResumen[]);
      setEstadoCarga("ok");
    })();
    return () => {
      activo = false;
    };
  }, []);

  // Orden estable: año descendente, luego mes descendente (más reciente primero).
  const ordenados = React.useMemo(
    () =>
      [...meses].sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes)),
    [meses],
  );

  if (estadoCarga === "cargando") {
    return (
      <div className="flex flex-col gap-md" aria-label="Cargando historial">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (estadoCarga === "error") {
    return (
      <Card>
        <CardContent className="py-lg text-body text-error">{ERROR_CARGA}</CardContent>
      </Card>
    );
  }

  if (ordenados.length === 0) {
    return (
      <EmptyState
        title="Aún no hay meses liquidados"
        description="Cuando registres y cierres un mes en Liquidar, aparecerá aquí en tu historial."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Mes</TableHead>
          <TableHead scope="col">Estado</TableHead>
          <TableHead scope="col" className="text-right">
            Total
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordenados.map((m) => (
          <TableRow key={`${m.anio}-${m.mes}`}>
            <TableCell>
              <Link
                href={`/historial/${m.anio}/${m.mes}`}
                className="font-semibold text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {etiquetaPeriodo(m.anio, m.mes)}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={m.estado === "CERRADA" ? "success" : "neutral"}>
                {m.estado === "CERRADA" ? "Cerrada" : "Borrador"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <CurrencyDisplay amount={m.total} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
