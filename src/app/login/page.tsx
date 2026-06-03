import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

// Pantalla /login del empleador (navigation_map.md §Zona Empleador). Auth no
// requerida. Mobile-first: la tarjeta de acceso centrada sobre el fondo de página.
export const metadata: Metadata = {
  title: "Iniciar sesión — MiEmpleadApp",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-md">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-h1">MiEmpleadApp</CardTitle>
          <CardDescription>Inicia sesión para administrar tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
