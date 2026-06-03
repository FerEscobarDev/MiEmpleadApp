import bcrypt from "bcryptjs";

// Hashing y verificación de la contraseña del empleador (architecture.md §4: el
// Empleador guarda passwordHash, nunca texto plano; §5.2: las credenciales no se
// loguean). Usa bcryptjs (JS puro, compatible con el stack Node/SQLite). El salt
// es aleatorio por hash, por lo que dos hashes del mismo texto difieren pero ambos
// verifican.

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // bcrypt.compare tolera hashes con formato inválido devolviendo false; aun así
  // protegemos el flujo de login ante cualquier excepción inesperada (no debe
  // tumbar la autenticación: credenciales no verificadas ⇒ false).
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
