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

export async function buscarEmpleadaPorId(
  empleadaId: string,
): Promise<Empleada | undefined> {
  const empleada = await db.empleada.findUnique({ where: { id: empleadaId } });
  return empleada ?? undefined;
}

// Resuelve la (única) empleada de la cuenta. La usa la costura de auth de Epic 3.1
// mientras no existe la sesión real (Epic 4.2); centraliza el acceso a la base en
// la capa de persistencia (architecture.md §6) en vez de tocar Prisma desde la
// costura.
export async function buscarPrimeraEmpleadaId(): Promise<string | undefined> {
  const empleada = await db.empleada.findFirst({ select: { id: true } });
  return empleada?.id ?? undefined;
}

// Datos persistibles de la ficha de la empleada (sin id ni empleadorId).
export interface FichaEmpleadaInput {
  nombre: string;
  fechaNacimiento: Date;
  fechaInicioContrato: Date;
  fechaFinContrato: Date | null;
}

// Actualiza la ficha de una empleada existente (Epic 3.1). La empleada ya existe
// (la crea el flujo de cuenta del empleador); aquí solo se editan sus campos.
export async function actualizarFichaEmpleada(
  empleadaId: string,
  datos: FichaEmpleadaInput,
): Promise<Empleada> {
  return db.empleada.update({
    where: { id: empleadaId },
    data: {
      nombre: datos.nombre,
      fechaNacimiento: datos.fechaNacimiento,
      fechaInicioContrato: datos.fechaInicioContrato,
      fechaFinContrato: datos.fechaFinContrato,
    },
  });
}

// Datos persistibles de la configuración (sin id ni empleadaId).
export interface ConfiguracionInput {
  salarioBase: number;
  diasLaborales: string[];
}

// Upsert de la configuración por empleada (Epic 3.1). diasLaborales se guarda
// como JSON (SQLite). Una sola configuración por empleada (@@unique).
export async function guardarConfiguracion(
  empleadaId: string,
  datos: ConfiguracionInput,
): Promise<Configuracion> {
  return db.configuracion.upsert({
    where: { empleadaId },
    create: {
      empleadaId,
      salarioBase: datos.salarioBase,
      diasLaborales: datos.diasLaborales,
    },
    update: {
      salarioBase: datos.salarioBase,
      diasLaborales: datos.diasLaborales,
    },
  });
}
