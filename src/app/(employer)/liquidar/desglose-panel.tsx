import { CurrencyDisplay } from "@/components/domain/CurrencyDisplay";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import type { components } from "@/lib/api/schema";

// Panel de desglose de la liquidación (design_system.md §3 — StatBlock/Panel de
// Desglose). Muestra las líneas etiquetadas del cálculo y el TOTAL destacado en una
// Card highlight con tipografía display. NO calcula nada: solo renderiza los campos
// que devuelve el contrato (Desglose). Moneda por el único formateador (CurrencyDisplay).

type Desglose = components["schemas"]["Desglose"];

interface LineaProps {
  etiqueta: string;
  children: React.ReactNode;
}

function Linea({ etiqueta, children }: LineaProps) {
  return (
    <div className="flex items-center justify-between gap-md py-xs">
      <span className="text-caption text-foreground-muted">{etiqueta}</span>
      <span className="text-body text-foreground">{children}</span>
    </div>
  );
}

export interface DesglosePanelProps {
  desglose: Desglose;
}

export function DesglosePanel({ desglose }: DesglosePanelProps) {
  return (
    <Card variant="highlight">
      <CardHeader>
        <CardTitle>Desglose del mes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-sm">
        <dl className="flex flex-col divide-y divide-border">
          <Linea etiqueta="Días laborales del mes">
            {desglose.diasLaboralesMes}
          </Linea>
          <Linea etiqueta="Festivos en día laboral (no descontados)">
            {desglose.festivosEnDiaLaboral}
          </Linea>
          <Linea etiqueta="Días trabajados">{desglose.diasTrabajados}</Linea>
          <Linea etiqueta="Valor-día">
            <CurrencyDisplay amount={desglose.valorDia} />
          </Linea>
          <Linea etiqueta="Subtotal por días">
            <CurrencyDisplay amount={desglose.subtotalDias} />
          </Linea>
          <Linea etiqueta="Subtotal items adicionales">
            <CurrencyDisplay amount={desglose.subtotalItems} />
          </Linea>
          <Linea etiqueta="Subtotal montos puntuales">
            <CurrencyDisplay amount={desglose.subtotalMontosPuntuales} />
          </Linea>
        </dl>

        <div className="mt-sm flex items-center justify-between gap-md border-t-2 border-primary pt-md">
          <span className="text-h3 font-semibold text-foreground">Total a pagar</span>
          <CurrencyDisplay
            data-testid="liquidacion-total"
            amount={desglose.total}
            className="text-display text-primary-600"
          />
        </div>
      </CardContent>
    </Card>
  );
}
