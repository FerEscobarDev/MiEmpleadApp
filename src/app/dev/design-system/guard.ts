import { notFound } from "next/navigation";

// La ruta /dev/design-system es SOLO de desarrollo (BR-5): nunca debe quedar
// expuesta en producción. En build/runtime de producción, abortar con 404.
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
}
