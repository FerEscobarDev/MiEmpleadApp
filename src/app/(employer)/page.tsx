import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

// Inicio del empleador (navigation_map.md §`/` Inicio). Destino del login y arranque
// del shell. En este epic es un Inicio mínimo: saludo + accesos a las secciones. El
// contenido rico (estado del mes, total provisional, banner de cumpleaños — HU-15 /
// HU-27) llega en epics posteriores.

const ACCESOS: ReadonlyArray<{ nombre: string; ruta: string; detalle: string }> = [
  { nombre: "Configuración", ruta: "/configuracion", detalle: "Ficha, salario, días e items" },
  { nombre: "Liquidar", ruta: "/liquidar", detalle: "Registrar novedades y calcular el mes" },
  { nombre: "Historial", ruta: "/historial", detalle: "Meses liquidados" },
  { nombre: "Menú", ruta: "/menu", detalle: "Plantilla de comidas" },
  { nombre: "Tareas", ruta: "/tareas", detalle: "Rutina y checklist del día" },
];

export default function InicioPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Inicio</h1>
        <p className="text-body text-foreground-muted">
          Bienvenido a MiEmpleadApp. Administra la configuración, las liquidaciones,
          el menú y las tareas desde aquí.
        </p>
      </header>

      <ul className="grid gap-md sm:grid-cols-2">
        {ACCESOS.map(({ nombre, ruta, detalle }) => (
          <li key={ruta}>
            <Link
              href={ruta}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle>{nombre}</CardTitle>
                  <CardDescription>{detalle}</CardDescription>
                </CardHeader>
                <CardContent className="text-caption text-primary">Abrir →</CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
