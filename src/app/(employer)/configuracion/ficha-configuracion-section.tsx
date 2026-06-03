"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { BirthdayBanner } from "@/components/domain/BirthdayBanner";

// Sección de /configuracion (Spec ficha-y-configuracion). Carga la ficha de la
// empleada y la configuración por el cliente tipado y permite editarlas. Es solo
// presentación: NO contiene lógica de negocio (cálculos, festivos) — esa vive en
// el dominio del backend. El salario se muestra/edita en COP enteros (RN-16); el
// único formateador de moneda es lib/currency (no se duplica aquí).

type Empleada = components["schemas"]["Empleada"];
type Configuracion = components["schemas"]["Configuracion"];
type DiaSemana = components["schemas"]["DiaSemana"];

const DIAS: ReadonlyArray<{ valor: DiaSemana; etiqueta: string }> = [
  { valor: "LUNES", etiqueta: "Lunes" },
  { valor: "MARTES", etiqueta: "Martes" },
  { valor: "MIERCOLES", etiqueta: "Miércoles" },
  { valor: "JUEVES", etiqueta: "Jueves" },
  { valor: "VIERNES", etiqueta: "Viernes" },
  { valor: "SABADO", etiqueta: "Sábado" },
  { valor: "DOMINGO", etiqueta: "Domingo" },
];

const ERROR_CARGA = "No pudimos cargar la configuración. Intenta de nuevo.";
const ERROR_GUARDADO = "No pudimos guardar los cambios. Intenta de nuevo.";

// Devuelve true si la fecha de nacimiento (YYYY-MM-DD) cae hoy (día y mes), en la
// fecha local del dispositivo (RN-20). Comparar solo mes/día evita depender del año.
function esCumpleHoy(fechaNacimiento: string): boolean {
  const partes = fechaNacimiento.split("-");
  if (partes.length !== 3) {
    return false;
  }
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  const hoy = new Date();
  return hoy.getMonth() + 1 === mes && hoy.getDate() === dia;
}

export function FichaConfiguracionSection() {
  const [cargando, setCargando] = React.useState(true);
  const [errorCarga, setErrorCarga] = React.useState(false);

  const [nombre, setNombre] = React.useState("");
  const [fechaNacimiento, setFechaNacimiento] = React.useState("");
  const [fechaInicioContrato, setFechaInicioContrato] = React.useState("");
  const [fechaFinContrato, setFechaFinContrato] = React.useState("");
  const [salarioBase, setSalarioBase] = React.useState(0);
  const [diasLaborales, setDiasLaborales] = React.useState<DiaSemana[]>([]);

  const [guardandoFicha, setGuardandoFicha] = React.useState(false);
  const [guardandoConfig, setGuardandoConfig] = React.useState(false);

  React.useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [empleadaRes, configRes] = await Promise.all([
          apiClient.GET("/empleada"),
          apiClient.GET("/configuracion"),
        ]);
        if (!activo) {
          return;
        }
        const empleada = empleadaRes.data as Empleada | undefined;
        const config = configRes.data as Configuracion | undefined;
        if (!empleada || !config || empleadaRes.error || configRes.error) {
          throw new Error("respuesta inválida");
        }
        setNombre(empleada.nombre);
        setFechaNacimiento(empleada.fechaNacimiento);
        setFechaInicioContrato(empleada.fechaInicioContrato);
        setFechaFinContrato(empleada.fechaFinContrato ?? "");
        setSalarioBase(config.salarioBase);
        setDiasLaborales(config.diasLaborales);
      } catch {
        if (!activo) {
          return;
        }
        setErrorCarga(true);
        toast.error(ERROR_CARGA);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  function alternarDia(dia: DiaSemana) {
    setDiasLaborales((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
  }

  async function guardarFicha() {
    if (guardandoFicha) {
      return;
    }
    setGuardandoFicha(true);
    try {
      const body: Empleada = {
        nombre,
        fechaNacimiento,
        fechaInicioContrato,
        fechaFinContrato: fechaFinContrato ? fechaFinContrato : null,
      };
      const { error } = await apiClient.PUT("/empleada", { body });
      if (error) {
        throw new Error("error al guardar ficha");
      }
      toast.success("Ficha guardada.");
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardandoFicha(false);
    }
  }

  async function guardarConfiguracion() {
    if (guardandoConfig) {
      return;
    }
    setGuardandoConfig(true);
    try {
      const body: Configuracion = { salarioBase, diasLaborales };
      const { error } = await apiClient.PUT("/configuracion", { body });
      if (error) {
        throw new Error("error al guardar configuración");
      }
      toast.success("Configuración guardada.");
    } catch {
      toast.error(ERROR_GUARDADO);
    } finally {
      setGuardandoConfig(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col gap-md" aria-label="Cargando configuración">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (errorCarga) {
    return (
      <Card>
        <CardContent className="py-lg text-body text-error">{ERROR_CARGA}</CardContent>
      </Card>
    );
  }

  const mostrarBanner = fechaNacimiento && esCumpleHoy(fechaNacimiento);

  return (
    <div className="flex flex-col gap-lg">
      {mostrarBanner ? <BirthdayBanner nombre={nombre} cuando="¡Hoy!" /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Ficha de la empleada</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              void guardarFicha();
            }}
          >
            <Input
              id="ficha-nombre"
              label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Input
              id="ficha-nacimiento"
              type="date"
              label="Fecha de nacimiento"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
            />
            <Input
              id="ficha-inicio"
              type="date"
              label="Inicio de contrato"
              value={fechaInicioContrato}
              onChange={(e) => setFechaInicioContrato(e.target.value)}
            />
            <Input
              id="ficha-fin"
              type="date"
              label="Fin de contrato"
              helperText="Opcional. Déjalo vacío si el contrato sigue vigente."
              value={fechaFinContrato}
              onChange={(e) => setFechaFinContrato(e.target.value)}
            />
            <Button type="submit" loading={guardandoFicha} className="self-start">
              Guardar ficha
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Salario y días laborales</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-md"
            onSubmit={(e) => {
              e.preventDefault();
              void guardarConfiguracion();
            }}
          >
            <Input
              id="config-salario"
              type="number"
              inputMode="numeric"
              currency
              label="Salario base (COP)"
              value={Number.isNaN(salarioBase) ? "" : salarioBase}
              onChange={(e) => setSalarioBase(Number(e.target.value))}
            />
            <fieldset className="flex flex-col gap-sm">
              <legend className="text-caption font-medium text-foreground">
                Días laborales
              </legend>
              <ul className="flex flex-col gap-xs">
                {DIAS.map(({ valor, etiqueta }) => {
                  const switchId = `dia-${valor.toLowerCase()}`;
                  return (
                    <li key={valor} className="flex items-center justify-between gap-md">
                      <Label htmlFor={switchId}>{etiqueta}</Label>
                      <Switch
                        id={switchId}
                        aria-label={etiqueta}
                        checked={diasLaborales.includes(valor)}
                        onCheckedChange={() => alternarDia(valor)}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
            <Button type="submit" loading={guardandoConfig} className="self-start">
              Guardar configuración
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
