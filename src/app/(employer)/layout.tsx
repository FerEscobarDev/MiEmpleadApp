import { SessionGuard } from "@/components/shell/SessionGuard";
import { EmployerShell } from "@/components/shell/EmployerShell";

// Layout del grupo de rutas protegidas del empleador (conventions.md §2 — grupo
// `(employer)`). Toda ruta dentro del grupo queda detrás del guard de sesión
// (RN-13: acceso no autenticado → /login) y se envuelve en el shell con la
// navegación de 6 secciones y el menú de "Cerrar sesión". Las páginas de las
// secciones (configuración, liquidar, etc.) se añaden bajo este grupo en epics
// posteriores; en este epic solo vive `/` (Inicio).
export default function EmployerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SessionGuard>
      <EmployerShell>{children}</EmployerShell>
    </SessionGuard>
  );
}
