import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { FichaConfiguracionSection } from "./ficha-configuracion-section";
import { ItemsAdicionalesSection } from "./items-adicionales-section";
import { EnlaceAccesoSection } from "./enlace-acceso-section";

// Página /configuracion (navigation_map.md §`/configuracion`), dentro del grupo
// protegido `(employer)` ⇒ detrás del SessionGuard y el shell del empleador (RN-13).
// Reúne las tres secciones del epic 8.2: ficha/salario/días laborales, items de pago
// adicional y enlace de acceso de la empleada. Cada sección es un componente cliente
// que consume el contrato vía el cliente tipado.

export default function ConfiguracionPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Configuración</h1>
        <p className="text-body text-foreground-muted">
          Define la ficha de la empleada, su salario, los días laborales, los conceptos
          de pago adicional y el enlace de acceso de solo lectura.
        </p>
      </header>

      <FichaConfiguracionSection />

      <Card>
        <CardHeader>
          <CardTitle>Items de pago adicional</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemsAdicionalesSection />
        </CardContent>
      </Card>

      <EnlaceAccesoSection />
    </section>
  );
}
