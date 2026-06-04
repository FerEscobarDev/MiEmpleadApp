// Bootstrap de la cuenta del empleador en RUNTIME (Epic 9.1 / RN-13).
//
// Equivalente en JS plano del seed `scripts/seed-empleador.ts`, pensado para
// ejecutarse desde el entrypoint del contenedor de producción: la imagen runtime
// NO incluye `tsx` ni el código fuente TS, pero sí el cliente Prisma generado y
// `bcryptjs` (dependencias de producción). Por eso aquí no se importa nada de
// `src/`: se replica la lógica mínima (hash bcrypt cost 10 + alta de
// empleador/empleada/configuración por defecto).
//
// Es IDEMPOTENTE por email y NO bloquea el arranque: si faltan las variables o
// algo falla, registra y termina con código 0 para que el servidor igual levante.
//
// Variables: EMPLEADOR_EMAIL, EMPLEADOR_PASSWORD (opcionales). Si no están, no se
// crea nada (despliegue sin bootstrap automático).

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 10;
const DIAS_LABORALES_DEFAULT = [
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
];

async function main() {
  const email = process.env.EMPLEADOR_EMAIL;
  const password = process.env.EMPLEADOR_PASSWORD;

  if (!email || !password) {
    console.log(
      "[bootstrap] EMPLEADOR_EMAIL/EMPLEADOR_PASSWORD no definidos; se omite el alta automática.",
    );
    return;
  }

  const db = new PrismaClient();
  try {
    const existente = await db.empleador.findUnique({ where: { email } });
    if (existente) {
      console.log(
        `[bootstrap] Ya existe un empleador con email ${email}; no se crea otro.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const empleador = await db.empleador.create({
      data: {
        email,
        passwordHash,
        empleada: {
          create: {
            nombre: "Empleada",
            fechaNacimiento: new Date("1990-01-01"),
            fechaInicioContrato: new Date(),
            fechaFinContrato: null,
            configuracion: {
              create: {
                salarioBase: 700000,
                diasLaborales: DIAS_LABORALES_DEFAULT,
              },
            },
          },
        },
      },
    });
    console.log(
      `[bootstrap] Empleador creado: ${empleador.email} (id ${empleador.id}).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  // No tumbar el arranque: registra y sale 0 para que el servidor igual levante.
  console.error("[bootstrap] Error al crear la cuenta del empleador:", error);
});
