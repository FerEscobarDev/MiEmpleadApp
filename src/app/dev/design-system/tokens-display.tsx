import * as React from "react";
import { Section } from "./sections";

// Muestra estática de la paleta de tokens, la escala tipográfica y la de
// spacing (AC-15). Sirve para la aprobación visual del Design System.

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-xs">
      <div className={`size-14 rounded-md border border-border ${className}`} aria-hidden="true" />
      <span className="text-caption text-foreground-muted">{name}</span>
    </div>
  );
}

export function TokenPalette() {
  return (
    <Section title="Tokens — Paleta de color">
      <h3 className="text-h3 font-semibold">Marca y semánticos</h3>
      <div className="flex flex-wrap gap-md">
        <Swatch name="primary" className="bg-primary" />
        <Swatch name="primary-hover" className="bg-primary-hover" />
        <Swatch name="primary-soft" className="bg-primary-soft" />
        <Swatch name="secondary" className="bg-secondary" />
        <Swatch name="accent" className="bg-accent" />
        <Swatch name="success" className="bg-success" />
        <Swatch name="warning" className="bg-warning" />
        <Swatch name="error" className="bg-error" />
        <Swatch name="info" className="bg-info" />
      </div>
      <h3 className="text-h3 font-semibold">Neutrales (slate)</h3>
      <div className="flex flex-wrap gap-md">
        <Swatch name="neutral.50" className="bg-neutral-50" />
        <Swatch name="neutral.100" className="bg-neutral-100" />
        <Swatch name="neutral.200" className="bg-neutral-200" />
        <Swatch name="neutral.400" className="bg-neutral-400" />
        <Swatch name="neutral.600" className="bg-neutral-600" />
        <Swatch name="neutral.800" className="bg-neutral-800" />
        <Swatch name="neutral.900" className="bg-neutral-900" />
      </div>
      <h3 className="text-h3 font-semibold">Calendario (con etiqueta — nunca solo color)</h3>
      <div className="flex flex-wrap gap-md">
        <Swatch name="trabajado" className="bg-cal-trabajado" />
        <Swatch name="inasistencia" className="bg-cal-inasistencia" />
        <Swatch name="festivo" className="bg-cal-festivo" />
        <Swatch name="noLaboral" className="bg-cal-noLaboral" />
        <Swatch name="fueraContrato" className="bg-cal-fueraContrato" />
        <Swatch name="itemAdicional" className="bg-cal-itemAdicional" />
      </div>
    </Section>
  );
}

export function TypeScale() {
  return (
    <Section title="Tokens — Escala tipográfica (Inter)">
      <p className="text-display">Display 30 · Total a pagar</p>
      <p className="text-h1">H1 24 · Título de pantalla</p>
      <p className="text-h2">H2 20 · Subtítulo de sección</p>
      <p className="text-h3">H3 17 · Encabezado de tarjeta</p>
      <p className="text-body">Body 16 · Texto general de la aplicación</p>
      <p className="text-caption">Caption 13 · Labels, ayudas y leyendas</p>
      <p className="text-money text-body">Money tabular · $ 1.500.000</p>
    </Section>
  );
}

const SPACES = [
  { name: "xs", cls: "w-xs" },
  { name: "sm", cls: "w-sm" },
  { name: "md", cls: "w-md" },
  { name: "lg", cls: "w-lg" },
  { name: "xl", cls: "w-xl" },
  { name: "2xl", cls: "w-2xl" },
];

export function SpacingScale() {
  return (
    <Section title="Tokens — Escala de spacing">
      <div className="flex flex-col gap-sm">
        {SPACES.map((s) => (
          <div key={s.name} className="flex items-center gap-md">
            <span className="w-10 text-caption text-foreground-muted">{s.name}</span>
            <div className={`h-4 rounded-sm bg-primary ${s.cls}`} aria-hidden="true" />
          </div>
        ))}
      </div>
    </Section>
  );
}
