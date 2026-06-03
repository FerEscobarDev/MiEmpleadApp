import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Fusiona listas de clases condicionales (clsx) y resuelve conflictos de
// utilidades de Tailwind (tailwind-merge). Lo consumen todos los componentes
// del Design System para componer clases sin duplicar variantes.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
