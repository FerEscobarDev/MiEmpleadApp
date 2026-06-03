import { LiquidarMesSection } from "./liquidar-mes-section";

// Página /liquidar (navigation_map.md §`/liquidar`), dentro del grupo protegido
// `(employer)` ⇒ detrás del SessionGuard y el shell del empleador (RN-13). Selección
// de mes/año, calendario coloreado, registro de novedades, desglose destacado del
// total y acciones de cerrar/reabrir. Toda la interacción con el backend ocurre en
// la sección cliente, exclusivamente por el cliente tipado.

function periodoActual(): { anio: number; mes: number } {
  const hoy = new Date();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };
}

export default function LiquidarPage() {
  const { anio, mes } = periodoActual();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Liquidar mes</h1>
        <p className="text-body text-foreground-muted">
          Elige un mes, registra las novedades sobre el calendario y revisa el total a
          pagar. Cierra la liquidación cuando esté lista; puedes reabrirla para corregir.
        </p>
      </header>

      <LiquidarMesSection anioInicial={anio} mesInicial={mes} />
    </section>
  );
}
