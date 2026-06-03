"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { BirthdayBanner } from "@/components/domain/BirthdayBanner";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import type { components } from "@/lib/api/schema";
import { createConsultaClient, esCumpleanosHoy } from "./consulta-client";
import { PagoTab } from "./pago-tab";
import { MenuTab } from "./menu-tab";
import { TareasTab } from "./tareas-tab";

// Vista de consulta de la empleada (Spec consult-client-shell, HU-03/RN-13/RN-20).
// Al montar valida el token (validarAccesoEmpleada, header X-Acceso-Token). Si es
// inválido/revocado (401) → pantalla amable. Si es válido → carga la ficha
// (obtenerEmpleada) y renderiza el shell: nombre + Avatar + BirthdayBanner (si hoy
// es su cumpleaños) y las pestañas Pago/Menú/Tareas. NO usa SessionGuard ni el shell
// del empleador: es una ruta pública por token. Toda la I/O pasa por el cliente de
// consulta que inyecta el header; nunca se escriben URLs a mano.

type Empleada = components["schemas"]["Empleada"];

type Estado = "validando" | "invalido" | "cargando-ficha" | "error-ficha" | "ok";

export interface ConsultaViewProps {
  token: string;
  // La fecha de hoy se inyecta para testabilidad (conventions.md §3/§7).
  hoy?: Date;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).slice(0, 2);
  return partes.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function ConsultaView({ token, hoy = new Date() }: ConsultaViewProps) {
  const client = React.useMemo(() => createConsultaClient(token), [token]);
  const [estado, setEstado] = React.useState<Estado>("validando");
  const [empleada, setEmpleada] = React.useState<Empleada | null>(null);

  React.useEffect(() => {
    let activo = true;
    setEstado("validando");
    (async () => {
      const { data, error } = await client.GET("/acceso/validar");
      if (!activo) return;
      if (error || !data) {
        setEstado("invalido");
        return;
      }
      // Token válido: cargar la ficha de la empleada.
      setEstado("cargando-ficha");
      const ficha = await client.GET("/empleada");
      if (!activo) return;
      if (ficha.error || !ficha.data) {
        setEstado("error-ficha");
        return;
      }
      setEmpleada(ficha.data as Empleada);
      setEstado("ok");
    })();
    return () => {
      activo = false;
    };
  }, [client]);

  if (estado === "validando" || estado === "cargando-ficha") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-md p-lg">
        <div aria-label="Cargando tu consulta" className="flex flex-col gap-md">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  if (estado === "invalido") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-md p-lg text-center">
        <h1 className="text-h1 font-bold text-foreground">Enlace inválido o revocado</h1>
        <p className="text-body text-foreground-muted">
          Este enlace de consulta ya no es válido. Pídele a tu empleador que te
          comparta un enlace nuevo.
        </p>
      </main>
    );
  }

  if (estado === "error-ficha" || !empleada) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-md p-lg text-center">
        <h1 className="text-h1 font-bold text-foreground">No pudimos cargar tu información</h1>
        <p className="text-body text-foreground-muted">
          Ocurrió un error al cargar tus datos. Intenta abrir el enlace de nuevo.
        </p>
      </main>
    );
  }

  const cumpleHoy = esCumpleanosHoy(empleada.fechaNacimiento, hoy);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-lg p-lg">
      <OfflineIndicator />
      <header className="flex items-center gap-md">
        <Avatar>
          <AvatarFallback>{iniciales(empleada.nombre)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-caption text-foreground-muted">Consulta de</span>
          <h1 className="text-h1 font-bold text-foreground">{empleada.nombre}</h1>
        </div>
      </header>

      {cumpleHoy ? <BirthdayBanner nombre={empleada.nombre} cuando="¡Hoy!" /> : null}

      <Tabs defaultValue="pago">
        <TabsList aria-label="Secciones de la consulta">
          <TabsTrigger value="pago">Pago</TabsTrigger>
          <TabsTrigger value="menu">Menú</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
        </TabsList>
        <TabsContent value="pago">
          <PagoTab client={client} hoy={hoy} />
        </TabsContent>
        <TabsContent value="menu">
          <MenuTab client={client} hoy={hoy} />
        </TabsContent>
        <TabsContent value="tareas">
          <TareasTab client={client} hoy={hoy} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
