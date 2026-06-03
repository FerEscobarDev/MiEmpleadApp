import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ConfiguracionMenuSection } from "./configuracion-menu-section";
import { PlantillaMenuSection } from "./plantilla-menu-section";

// Página /menu (navigation_map.md §`/menu`, HU-20/21/22), dentro del grupo protegido
// `(employer)` ⇒ detrás del SessionGuard y el shell del empleador (RN-13). Reúne la
// configuración de comidas/periodicidad y la plantilla del menú (tablero por semana).
// La I/O con el backend ocurre en las secciones cliente, solo por el cliente tipado.
export default function MenuPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Menú de cocina</h1>
        <p className="text-body text-foreground-muted">
          Configura las comidas y la periodicidad, y define la plantilla del menú que se
          repite por día.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfiguracionMenuSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plantilla del menú</CardTitle>
        </CardHeader>
        <CardContent>
          <PlantillaMenuSection />
        </CardContent>
      </Card>
    </section>
  );
}
