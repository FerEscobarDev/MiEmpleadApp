import { randomBytes, createHash } from "node:crypto";

// Generación y hashing del token de acceso de la empleada (Epic 4.2).
// El token visible (que se comparte en el enlace) es aleatorio criptográficamente
// fuerte; en reposo solo se guarda su hash SHA-256, de modo que una filtración de
// la base no expone un secreto reutilizable (architecture.md §5.2: no se loggea ni
// persiste el token en claro). La validación re-hashea el token recibido y compara.

// 32 bytes aleatorios en base64url ⇒ token corto, seguro y url-safe.
export function generarTokenAcceso(): string {
  return randomBytes(32).toString("base64url");
}

// Hash determinista (SHA-256, hex) del token: lo que se persiste y se compara.
export function hashTokenAcceso(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
