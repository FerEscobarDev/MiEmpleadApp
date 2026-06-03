"use client";

import * as React from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MenuBoard, type DiaSemana } from "@/components/domain/MenuBoard";
import type { components } from "@/lib/api/schema";
import type { ConsultaClient } from "./consulta-client";

// Pestaña Menú de la consulta de la empleada (Spec pago-menu-tabs, HU-22).
// obtenerMenu (vía cliente de consulta con X-Acceso-Token) → "qué preparar hoy"
// destacado + tablero semanal en SOLO LECTURA (MenuBoard sin inputs). Sin lógica de
// negocio: solo da forma a lo que devuelve el contrato.

type Menu = components["schemas"]["Menu"];

const ERROR_CARGA = "No pudimos cargar el menú. Intenta de nuevo.";

type Estado = "cargando" | "ok" | "error";

const DIA_LABEL: Record<DiaSemana, string> = {
  LUNES: "Lunes",
  MARTES: "Martes",
  MIERCOLES: "Miércoles",
  JUEVES: "Jueves",
  VIERNES: "Viernes",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

// getDay() (0=Domingo) → DiaSemana. La fecha se recibe como parámetro (testable).
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

export interface MenuTabProps {
  client: ConsultaClient;
  hoy?: Date;
}

export function MenuTab({ client, hoy = new Date() }: MenuTabProps) {
  const [estado, setEstado] = React.useState<Estado>("cargando");
  const [menu, setMenu] = React.useState<Menu | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstado("cargando");
    (async () => {
      const { data, error } = await client.GET("/menu");
      if (!activo) return;
      if (error || !data) {
        setEstado("error");
        toast.error(ERROR_CARGA);
        return;
      }
      setMenu(data as Menu);
      setEstado("ok");
    })();
    return () => {
      activo = false;
    };
  }, [client]);

  if (estado === "cargando") {
    return (
      <div className="flex flex-col gap-md" aria-label="Cargando el menú">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (estado === "error") {
    return <p className="text-body text-error">{ERROR_CARGA}</p>;
  }

  const comidas = menu?.configuracion.comidas ?? [];
  const entradas = menu?.configuracion ? (menu.entradas ?? []) : [];
  const diaHoy = diaSemanaDeFecha(hoy);

  // "Qué preparar hoy" = entradas de la semana 0 para el día actual (la consulta de
  // solo lectura no rota ciclos quincenales/mensuales: usa la primera semana).
  const platosDeHoy = entradas
    .filter((e) => e.semana === 0 && e.diaSemana === diaHoy)
    .map((e) => ({ comida: e.comida, descripcion: e.descripcion }))
    .filter((p) => p.descripcion.trim().length > 0);

  return (
    <div className="flex flex-col gap-lg">
      <Card variant="highlight">
        <CardHeader>
          <CardTitle>Qué preparar hoy · {DIA_LABEL[diaHoy]}</CardTitle>
        </CardHeader>
        <CardContent>
          {platosDeHoy.length === 0 ? (
            <p className="text-body text-foreground-muted">
              No hay nada definido para hoy.
            </p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {platosDeHoy.map((p) => (
                <li key={p.comida} className="flex flex-col">
                  <span className="text-caption text-foreground-muted">{p.comida}</span>
                  <span className="text-body font-semibold text-foreground">
                    {p.descripcion}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {comidas.length === 0 ? (
        <EmptyState
          title="Aún no hay menú definido"
          description="El empleador todavía no ha configurado el menú de la semana."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Menú de la semana</CardTitle>
          </CardHeader>
          <CardContent>
            <MenuBoard comidas={comidas} entradas={entradas} semana={0} diaHoy={diaHoy} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
