import type { Empleador, Empleada, Configuracion } from "@prisma/client";
import { db } from "@/lib/db";

// Repositorio delgado de empleada/configuración (architecture.md §2.5).
// Solo traduce a llamadas Prisma vía el cliente único; sin lógica de negocio
// (conventions.md §4). Los epics de API extenderán estas operaciones.

export interface CrearEmpleadorConEmpleadaInput {
  email: string;
  passwordHash: string;
  nombre: string;
  fechaNacimiento: Date;
  fechaInicioContrato: Date;
  fechaFinContrato?: Date | null;
  salarioBase: number;
  diasLaborales: string[];
}

export interface EmpleadorConEmpleada {
  empleador: Empleador;
  empleada: Empleada;
  configuracion: Configuracion;
}

export async function crearEmpleadorConEmpleada(
  input: CrearEmpleadorConEmpleadaInput,
): Promise<EmpleadorConEmpleada> {
  const empleador = await db.empleador.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
      empleada: {
        create: {
          nombre: input.nombre,
          fechaNacimiento: input.fechaNacimiento,
          fechaInicioContrato: input.fechaInicioContrato,
          fechaFinContrato: input.fechaFinContrato ?? null,
          configuracion: {
            create: {
              salarioBase: input.salarioBase,
              diasLaborales: input.diasLaborales,
            },
          },
        },
      },
    },
    include: { empleada: { include: { configuracion: true } } },
  });

  const empleada = empleador.empleada!;
  return { empleador, empleada, configuracion: empleada.configuracion! };
}

export async function buscarEmpleadaPorEmpleador(
  empleadorId: string,
): Promise<Empleada | undefined> {
  const empleada = await db.empleada.findUnique({ where: { empleadorId } });
  return empleada ?? undefined;
}

export async function obtenerConfiguracionDeEmpleada(
  empleadaId: string,
): Promise<Configuracion | undefined> {
  const config = await db.configuracion.findUnique({ where: { empleadaId } });
  return config ?? undefined;
}
