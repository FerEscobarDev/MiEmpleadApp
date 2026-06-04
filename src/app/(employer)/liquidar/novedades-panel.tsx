"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { CurrencyDisplay } from "@/components/domain/CurrencyDisplay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

// Panel de novedades de /liquidar (Spec novedades). Captura cantidades de items
// (poblados desde listarItemsAdicionales), montos puntuales sueltos y las notas
// privadas del empleador (RN-12). NO calcula: delega cada guardado en el contenedor,
// que llama a actualizarLiquidacion y refresca con la respuesta. En estado CERRADA
// todos los controles quedan deshabilitados (RN-11).

type ItemAdicional = components["schemas"]["ItemAdicional"];
type LiquidacionItem = components["schemas"]["LiquidacionItem"];
type MontoPuntual = components["schemas"]["MontoPuntual"];

export interface NovedadesPanelProps {
  itemsCatalogo: ItemAdicional[];
  itemsLiquidacion: LiquidacionItem[];
  montosPuntuales: MontoPuntual[];
  notas: string;
  editable: boolean;
  onGuardarItems: (items: { itemId: string; cantidad: number }[]) => void | Promise<void>;
  onAgregarMonto: (descripcion: string, monto: number) => void | Promise<void>;
  onGuardarNotas: (notas: string) => void | Promise<void>;
}

export function NovedadesPanel({
  itemsCatalogo,
  itemsLiquidacion,
  montosPuntuales,
  notas,
  editable,
  onGuardarItems,
  onAgregarMonto,
  onGuardarNotas,
}: NovedadesPanelProps) {
  // Cantidades por item: inicializa con lo ya registrado en la liquidación.
  const [cantidades, setCantidades] = React.useState<Record<string, string>>({});
  const [descripcionMonto, setDescripcionMonto] = React.useState("");
  const [montoValor, setMontoValor] = React.useState("");
  const [notasTexto, setNotasTexto] = React.useState(notas);

  React.useEffect(() => {
    const inicial: Record<string, string> = {};
    for (const item of itemsCatalogo) {
      const registrado = itemsLiquidacion.find((li) => li.itemId === item.id);
      inicial[item.id] = String(registrado?.cantidad ?? 0);
    }
    setCantidades(inicial);
  }, [itemsCatalogo, itemsLiquidacion]);

  React.useEffect(() => {
    setNotasTexto(notas);
  }, [notas]);

  function guardarItems() {
    const payload = itemsCatalogo.map((item) => ({
      itemId: item.id,
      cantidad: Number(cantidades[item.id] ?? 0) || 0,
    }));
    void onGuardarItems(payload);
  }

  function agregarMonto() {
    const monto = Number(montoValor);
    if (!descripcionMonto.trim() || !Number.isFinite(monto) || monto <= 0) {
      return;
    }
    void onAgregarMonto(descripcionMonto.trim(), monto);
    setDescripcionMonto("");
    setMontoValor("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novedades del mes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-lg">
        {/* Items adicionales */}
        <section className="flex flex-col gap-md" aria-label="Items adicionales">
          <h4 className="text-bodyStrong font-semibold text-foreground">Items adicionales</h4>
          {itemsCatalogo.length === 0 ? (
            <EmptyState
              title="No hay items adicionales"
              description="Crea conceptos de pago adicional en Configuración para registrarlos aquí."
            />
          ) : (
            <>
              <ul className="flex flex-col gap-sm">
                {itemsCatalogo.map((item) => (
                  <li key={item.id} className="flex items-end justify-between gap-md">
                    <Input
                      id={`cantidad-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      label={`Cantidad de ${item.nombre}`}
                      className="w-24"
                      disabled={!editable}
                      value={cantidades[item.id] ?? "0"}
                      onChange={(e) =>
                        setCantidades((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                    <span
                      className="pb-sm text-caption text-foreground-muted"
                      aria-hidden="true"
                    >
                      Valor unitario <CurrencyDisplay amount={item.valorUnitario} />
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                className="self-start"
                disabled={!editable}
                onClick={guardarItems}
              >
                Guardar items
              </Button>
            </>
          )}
        </section>

        {/* Montos puntuales */}
        <section className="flex flex-col gap-md" aria-label="Montos puntuales">
          <h4 className="text-bodyStrong font-semibold text-foreground">Montos puntuales</h4>
          {montosPuntuales.length > 0 ? (
            <ul className="flex flex-col gap-xs">
              {montosPuntuales.map((m, i) => (
                <li
                  key={m.id ?? `${m.descripcion}-${i}`}
                  className="flex items-center justify-between gap-md text-body"
                >
                  <span>{m.descripcion}</span>
                  <CurrencyDisplay amount={m.monto} />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-end gap-md">
            <div className="min-w-[160px] flex-1">
              <Input
                id="monto-descripcion"
                label="Descripción del monto"
                disabled={!editable}
                value={descripcionMonto}
                onChange={(e) => setDescripcionMonto(e.target.value)}
              />
            </div>
            <Input
              id="monto-valor"
              type="number"
              inputMode="numeric"
              currency
              label="Monto puntual (COP)"
              className="w-40"
              disabled={!editable}
              value={montoValor}
              onChange={(e) => setMontoValor(e.target.value)}
            />
            <Button type="button" disabled={!editable} onClick={agregarMonto}>
              <Plus className="size-4" aria-hidden="true" />
              Agregar monto
            </Button>
          </div>
        </section>

        {/* Notas privadas */}
        <section className="flex flex-col gap-md">
          <Textarea
            id="liquidar-notas"
            label="Notas (privadas del empleador)"
            disabled={!editable}
            value={notasTexto}
            onChange={(e) => setNotasTexto(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            disabled={!editable}
            onClick={() => void onGuardarNotas(notasTexto)}
          >
            Guardar notas
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
