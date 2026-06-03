import { signIn } from "@/features/auth/auth";
import { loginInputSchema } from "@/features/auth/application/schemas";
import {
  errorResponse,
  validationErrorResponse,
} from "@/features/config/application/api-error";

// Frontera HTTP de iniciarSesionEmpleador (POST /api/v1/auth/login). Handler
// delgado que envuelve el sign-in de credenciales de Auth.js para que la
// superficie del contrato sea exacta: 204 al iniciar sesión, 401 NO_AUTORIZADO
// con credenciales inválidas, 422 VALIDACION si el body es inválido. Nunca se
// loguean credenciales (architecture.md §5.2). El envelope de error es el único
// del contrato.

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return validationErrorResponse({ body: "JSON inválido." });
  }

  const parsed = loginInputSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.issues);
  }

  try {
    // redirect:false ⇒ signIn no lanza una redirección; las credenciales inválidas
    // hacen que signIn lance (AuthError), que traducimos a 401.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    // Credenciales inválidas (CredentialsSignin / AuthError) ⇒ 401 sin revelar si
    // fue el email o la contraseña (architecture.md §5.1).
    console.error("Fallo de inicio de sesión del empleador");
    void error;
    return errorResponse(401, "NO_AUTORIZADO", "Credenciales inválidas.");
  }
}
