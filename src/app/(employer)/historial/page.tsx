import { HistorialSection } from "./historial-section";

// Página /historial (navigation_map.md §`/historial`, HU-17), dentro del grupo
// protegido `(employer)` ⇒ detrás del SessionGuard y el shell del empleador (RN-13).
// Listado de los meses registrados con su estado y total, enlazando al detalle de cada
// uno. La I/O con el backend ocurre en la sección cliente, solo por el cliente tipado.
export default function HistorialPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Historial</h1>
        <p className="text-body text-foreground-muted">
          Revisa los meses que has registrado. Toca un mes para ver su detalle, reabrirlo
          o eliminarlo.
        </p>
      </header>

      <HistorialSection />
    </section>
  );
}
