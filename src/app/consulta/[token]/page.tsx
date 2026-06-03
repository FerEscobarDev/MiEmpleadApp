import { ConsultaView } from "./consulta-view";

// Página pública por token /consulta/[token] (navigation_map.md §`/consulta/[token]`).
// FUERA del grupo `(employer)`: no hay SessionGuard ni shell del empleador; el acceso
// se gobierna por la validez del token (HU-03). Server Component que solo extrae el
// `token` del path y delega en la vista cliente, que valida el token y monta el shell.
// La I/O ocurre en la vista, exclusivamente por el cliente tipado de consulta.

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ConsultaPage({ params }: PageProps) {
  const { token } = await params;
  return <ConsultaView token={token} />;
}
