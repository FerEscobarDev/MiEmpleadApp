import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// Tests del hashing y verificación de contraseña del empleador
// (Epic 4.1, spec auth-empleador-credenciales). Sin DB ni mocks: lógica pura
// sobre bcryptjs. La contraseña NUNCA se almacena en texto plano (BR-1).

describe("password — hashPassword / verifyPassword", () => {
  it("AC-1: hashPassword no devuelve el texto plano ni lo contiene", async () => {
    const plain = "secreta-123";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.includes(plain)).toBe(false);
  });

  it("AC-2: verifyPassword es true para el hash de la misma contraseña", async () => {
    const plain = "secreta-123";
    const hash = await hashPassword(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
  });

  it("AC-3: verifyPassword es false para una contraseña incorrecta", async () => {
    const hash = await hashPassword("secreta-123");
    expect(await verifyPassword("otra-distinta", hash)).toBe(false);
  });

  it("AC-4: dos hashes del mismo texto difieren (salt) y ambos verifican", async () => {
    const plain = "secreta-123";
    const h1 = await hashPassword(plain);
    const h2 = await hashPassword(plain);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword(plain, h1)).toBe(true);
    expect(await verifyPassword(plain, h2)).toBe(true);
  });

  it("EC-3: verifyPassword con un hash con formato inválido devuelve false (no lanza)", async () => {
    await expect(verifyPassword("secreta-123", "no-es-un-hash")).resolves.toBe(false);
  });
});
