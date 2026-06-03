import { crearCuentaEmpleador } from "../src/features/auth/application/auth-service";
import { buscarEmpleadorPorEmail } from "../src/features/auth/data/empleador-repository";

// Bootstrap de la cuenta del empleador (single-tenant; no hay auto-registro
// público — RN-13). Lee EMPLEADOR_EMAIL y EMPLEADOR_PASSWORD del entorno y crea
// el empleador con su empleada/configuración por defecto. Idempotente a nivel de
// email: si ya existe un empleador con ese email, no crea otro.
//
// Uso: EMPLEADOR_EMAIL=... EMPLEADOR_PASSWORD=... npm run seed:empleador

async function main(): Promise<void> {
  const email = process.env.EMPLEADOR_EMAIL;
  const password = process.env.EMPLEADOR_PASSWORD;

  if (!email || !password) {
    console.error(
      "Faltan EMPLEADOR_EMAIL y/o EMPLEADOR_PASSWORD en el entorno. " +
        "Ejemplo: EMPLEADOR_EMAIL=jefe@ejemplo.com EMPLEADOR_PASSWORD=secreta npm run seed:empleador",
    );
    process.exitCode = 1;
    return;
  }

  const existente = await buscarEmpleadorPorEmail(email);
  if (existente) {
    console.log(`Ya existe un empleador con email ${email}; no se crea otro.`);
    return;
  }

  const { empleador } = await crearCuentaEmpleador({ email, password });
  console.log(`Empleador creado: ${empleador.email} (id ${empleador.id}).`);
}

main()
  .catch((error) => {
    console.error("Error al crear la cuenta del empleador:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Cierra el proceso del seed para que no quede colgado por la conexión Prisma.
    void import("../src/lib/db").then(({ db }) => db.$disconnect());
  });
