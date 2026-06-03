import { notFound } from "next/navigation";
import { DetalleMesSection } from "./detalle-mes-section";

// Página /historial/[anio]/[mes] (navigation_map.md §detalle; HU-18/19/14), dentro del
// grupo protegido `(employer)` ⇒ detrás del SessionGuard y el shell (RN-13). Resuelve los
// params de la ruta dinámica y delega en la sección cliente, que carga y administra el
// mes (ver/eliminar/reabrir) exclusivamente por el cliente tipado.
interface PageProps {
  params: Promise<{ anio: string; mes: string }>;
}

export default async function DetalleMesPage({ params }: PageProps) {
  const { anio: anioRaw, mes: mesRaw } = await params;
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);

  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    notFound();
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Detalle del mes</h1>
        <p className="text-body text-foreground-muted">
          Revisa el desglose, el calendario y las novedades de este mes. Puedes reabrirlo
          para corregir o eliminarlo del historial.
        </p>
      </header>

      <DetalleMesSection anio={anio} mes={mes} />
    </section>
  );
}
