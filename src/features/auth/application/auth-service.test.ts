import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  resetDatabase,
} from "@/lib/test/db-test-setup";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "../password";
import { buscarEmpleadorPorEmail } from "../data/empleador-repository";
import { authorizeEmpleador, crearCuentaEmpleador } from "./auth-service";

// Tests de la lógica de autenticación del empleador (Epic 4.1, spec
// auth-empleador-credenciales). Base SQLite real, sin mocks. authorizeEmpleador
// reproduce la lógica que consumirá el provider de credenciales de Auth.js (BR-3).

// Crea un empleador con contraseña conocida (hasheada) para los casos de authorize.
async function crearEmpleadorConPassword(
  email: string,
  password: string,
): Promise<string> {
  const passwordHash = await hashPassword(password);
  const empleador = await db.empleador.create({
    data: {
      email,
      passwordHash,
      empleada: {
        create: {
          nombre: "Empleada",
          fechaNacimiento: new Date("1990-01-01"),
          fechaInicioContrato: new Date("2026-01-01"),
        },
      },
    },
  });
  return empleador.id;
}

describe("auth-service — authorizeEmpleador", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-6: credenciales válidas devuelven la identidad { id, email }", async () => {
    const id = await crearEmpleadorConPassword("jefe@example.com", "clave-correcta");
    const identidad = await authorizeEmpleador({
      email: "jefe@example.com",
      password: "clave-correcta",
    });
    expect(identidad).toEqual({ id, email: "jefe@example.com" });
  });

  it("AC-7: email inexistente devuelve null", async () => {
    await crearEmpleadorConPassword("jefe@example.com", "clave-correcta");
    const identidad = await authorizeEmpleador({
      email: "nadie@example.com",
      password: "clave-correcta",
    });
    expect(identidad).toBeNull();
  });

  it("AC-8: contraseña incorrecta devuelve null", async () => {
    await crearEmpleadorConPassword("jefe@example.com", "clave-correcta");
    const identidad = await authorizeEmpleador({
      email: "jefe@example.com",
      password: "clave-equivocada",
    });
    expect(identidad).toBeNull();
  });

  it("EC-1: email o password vacío devuelve null (no lanza)", async () => {
    await crearEmpleadorConPassword("jefe@example.com", "clave-correcta");
    await expect(
      authorizeEmpleador({ email: "", password: "clave-correcta" }),
    ).resolves.toBeNull();
    await expect(
      authorizeEmpleador({ email: "jefe@example.com", password: "" }),
    ).resolves.toBeNull();
  });
});

describe("auth-service — crearCuentaEmpleador", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await resetDatabase();
  });

  it("AC-9: persiste el empleador con passwordHash (no texto plano) verificable y resoluble por email", async () => {
    await crearCuentaEmpleador({
      email: "nuevo@example.com",
      password: "mi-clave",
    });

    const found = await buscarEmpleadorPorEmail("nuevo@example.com");
    expect(found).toBeDefined();
    expect(found?.passwordHash).not.toBe("mi-clave");
    expect(await verifyPassword("mi-clave", found!.passwordHash)).toBe(true);
  });
});
