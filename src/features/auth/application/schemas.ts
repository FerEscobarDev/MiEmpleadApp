import { z } from "zod";

// Esquema Zod de la frontera de autenticación (architecture.md §5.4). Valida el
// body de iniciarSesionEmpleador antes de invocar el sign-in de Auth.js. La
// autoridad de verificación de credenciales vive en authorizeEmpleador; aquí solo
// se valida la FORMA del request (presencia de email y password).

export const loginInputSchema = z.object({
  email: z.string().min(1, "El email es obligatorio."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
