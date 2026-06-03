"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Formulario de inicio de sesión del empleador (spec login-page). Consume la
// operación del contrato iniciarSesionEmpleador EXCLUSIVAMENTE a través del cliente
// tipado (nunca una URL escrita a mano). El handler del backend establece la cookie
// de sesión de Auth.js; aquí solo orquestamos la UI: envío, redirección al éxito,
// error en línea con 401, estado de carga.

const ERROR_CREDENCIALES = "Credenciales inválidas.";
const ERROR_GENERICO = "No pudimos iniciar sesión. Intenta de nuevo.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function manejarEnvio(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) {
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const { response } = await apiClient.POST("/auth/login", {
        body: { email, password },
      });
      if (response.status === 204) {
        router.push("/");
        return;
      }
      // 401 ⇒ credenciales inválidas (sin revelar qué campo). Cualquier otro
      // estado ⇒ mensaje genérico.
      setError(response.status === 401 ? ERROR_CREDENCIALES : ERROR_GENERICO);
    } catch {
      setError(ERROR_GENERICO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={manejarEnvio} noValidate className="flex flex-col gap-md">
      <Input
        id="login-email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        id="login-password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? (
        <p
          role="alert"
          className="flex items-center gap-xs text-caption text-error"
        >
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={enviando} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
