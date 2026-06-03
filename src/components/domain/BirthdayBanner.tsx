import * as React from "react";
import { Cake } from "lucide-react";
import { cn } from "@/lib/utils";

// BirthdayBanner del Design System (design_system.md §4 — BirthdayBanner).
// Aviso cálido (accent) del cumpleaños de la empleada. Shell por props.
export interface BirthdayBannerProps {
  nombre: string;
  /** Texto opcional, ej. "¡Hoy!" o "en 3 días". */
  cuando?: string;
  className?: string;
}

export function BirthdayBanner({ nombre, cuando, className }: BirthdayBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-sm rounded-lg border border-accent/40 bg-accent/15 " +
          "px-lg py-md text-body text-accent-foreground",
        className,
      )}
    >
      <Cake className="size-5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        <span className="font-semibold">Cumpleaños de {nombre}</span>
        {cuando ? <span className="text-foreground-muted"> · {cuando}</span> : null}
      </span>
    </div>
  );
}
