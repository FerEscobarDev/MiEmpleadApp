import type { Empleador, Empleada, Configuracion } from "@prisma/client";
import { db } from "@/lib/db";

// Factory builder de datos de prueba (conventions.md §7). Crea agregados
// persistidos con valores por defecto sensatos y overrides parciales, para que
// los specs no dupliquen el armado de datos. El default de salario es 700000
// (RN-18). Cada invocación genera un empleador/empleada independientes.

let sequence = 0;

export interface EmpleadaAggregateOverrides {
  email?: string;
  passwordHash?: string;
  nombre?: string;
  fechaNacimiento?: Date;
  fechaInicioContrato?: Date;
  fechaFinContrato?: Date | null;
  salarioBase?: number;
  diasLaborales?: string[];
}

export interface EmpleadaAggregate {
  empleador: Empleador;
  empleada: Empleada;
  configuracion: Configuracion;
}

export async function buildEmpleadaAggregate(
  overrides: EmpleadaAggregateOverrides = {},
): Promise<EmpleadaAggregate> {
  sequence += 1;
  const unique = `${Date.now()}-${sequence}`;

  const empleador = await db.empleador.create({
    data: {
      email: overrides.email ?? `empleador-${unique}@example.com`,
      passwordHash: overrides.passwordHash ?? "hash-de-prueba",
      empleada: {
        create: {
          nombre: overrides.nombre ?? "Empleada de Prueba",
          fechaNacimiento: overrides.fechaNacimiento ?? new Date("1990-01-01"),
          fechaInicioContrato: overrides.fechaInicioContrato ?? new Date("2026-01-01"),
          fechaFinContrato: overrides.fechaFinContrato ?? null,
          configuracion: {
            create: {
              salarioBase: overrides.salarioBase ?? 700000,
              diasLaborales: overrides.diasLaborales ?? [
                "LUNES",
                "MARTES",
                "MIERCOLES",
                "JUEVES",
                "VIERNES",
                "SABADO",
              ],
            },
          },
        },
      },
    },
    include: { empleada: { include: { configuracion: true } } },
  });

  const empleada = empleador.empleada!;
  return {
    empleador,
    empleada,
    configuracion: empleada.configuracion!,
  };
}
