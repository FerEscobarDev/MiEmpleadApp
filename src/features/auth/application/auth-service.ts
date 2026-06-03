import {
  crearEmpleadorConEmpleada,
  type EmpleadorConEmpleada,
} from "@/features/config/data/empleada-repository";
import { buscarEmpleadorPorEmail } from "@/features/auth/data/empleador-repository";
import { hashPassword, verifyPassword } from "@/features/auth/password";

// Capa de aplicación de autenticación del empleador (architecture.md §2.6).
// Orquesta la verificación de credenciales (que consumirá el provider de
// credenciales de Auth.js) y el alta controlada de la cuenta del empleador
// (bootstrap; no hay auto-registro público, RN-13).

// Identidad mínima del empleador autenticado (la que Auth.js guarda en la sesión).
export interface EmpleadorIdentidad {
  id: string;
  email: string;
}

// Reproduce la lógica del `authorize` del provider de credenciales: dadas unas
// credenciales, resuelve la identidad del empleador o null. No distingue entre
// "email inexistente" y "contraseña incorrecta" hacia el llamador (BR-3): ambos
// devuelven null. No lanza ante credenciales inválidas; las excepciones se reservan
// para fallos de infraestructura (DB).
export async function authorizeEmpleador(credenciales: {
  email: string;
  password: string;
}): Promise<EmpleadorIdentidad | null> {
  const { email, password } = credenciales;
  if (!email || !password) {
    return null;
  }

  const empleador = await buscarEmpleadorPorEmail(email);
  if (!empleador) {
    return null;
  }

  const ok = await verifyPassword(password, empleador.passwordHash);
  if (!ok) {
    return null;
  }

  return { id: empleador.id, email: empleador.email };
}

// Datos de bootstrap de la cuenta del empleador. Solo email + password son
// obligatorios; el resto tiene defaults sensatos (RN-18: salario 700000) para que
// el seed cree una cuenta utilizable de inmediato. La ficha de la empleada se
// edita luego por la API de configuración (Epic 3.1).
export interface CrearCuentaEmpleadorInput {
  email: string;
  password: string;
  nombre?: string;
  fechaNacimiento?: Date;
  fechaInicioContrato?: Date;
  fechaFinContrato?: Date | null;
  salarioBase?: number;
  diasLaborales?: string[];
}

const DIAS_LABORALES_DEFAULT = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

export async function crearCuentaEmpleador(
  input: CrearCuentaEmpleadorInput,
): Promise<EmpleadorConEmpleada> {
  const passwordHash = await hashPassword(input.password);
  return crearEmpleadorConEmpleada({
    email: input.email,
    passwordHash,
    nombre: input.nombre ?? "Empleada",
    fechaNacimiento: input.fechaNacimiento ?? new Date("1990-01-01"),
    fechaInicioContrato: input.fechaInicioContrato ?? new Date(),
    fechaFinContrato: input.fechaFinContrato ?? null,
    salarioBase: input.salarioBase ?? 700000,
    diasLaborales: input.diasLaborales ?? DIAS_LABORALES_DEFAULT,
  });
}
