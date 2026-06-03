import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeEmpleador } from "@/features/auth/application/auth-service";

// Configuración de Auth.js (NextAuth v5, App Router) para la sesión del empleador
// (architecture.md §2.6 / §5.1). Provider de credenciales (email + contraseña) que
// delega la verificación en authorizeEmpleador (capa de aplicación; nunca toca
// Prisma desde aquí ni loguea credenciales — §5.2). Estrategia de sesión JWT
// (SQLite, instancia única; sin tabla de sesiones). El secreto sale de AUTH_SECRET.

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const identidad = await authorizeEmpleador({ email, password });
        if (!identidad) {
          return null;
        }
        // Auth.js guarda este objeto en el JWT/sesión.
        return { id: identidad.id, email: identidad.email };
      },
    }),
  ],
});
