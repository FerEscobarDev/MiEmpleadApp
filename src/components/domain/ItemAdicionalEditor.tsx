import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CurrencyDisplay } from "./CurrencyDisplay";

// ItemAdicionalEditor (shell) del Design System (design_system.md §4).
// Lista editable de items (nombre, valor unitario COP, color, activo). Shell
// presentacional por props: emite intenciones (crear/editar/eliminar) al padre,
// que las cablea al cliente tipado (Milestone 8).
export interface ItemAdicional {
  id: string;
  nombre: string;
  valorUnitario: number;
  color?: string | null;
  activo: boolean;
}

export interface ItemAdicionalEditorProps {
  items: ItemAdicional[];
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function ItemAdicionalEditor({
  items,
  onCreate,
  onEdit,
  onDelete,
  className,
}: ItemAdicionalEditorProps) {
  return (
    <div className={cn("flex flex-col gap-sm", className)}>
      <ul className="flex flex-col gap-xs">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-sm rounded-md border border-border bg-surface p-sm"
          >
            <span
              className="size-4 shrink-0 rounded-full ring-1 ring-border"
              style={item.color ? { backgroundColor: item.color } : undefined}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={onEdit ? () => onEdit(item.id) : undefined}
              className="flex-1 text-left text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.nombre}
            </button>
            <CurrencyDisplay amount={item.valorUnitario} className="text-caption" />
            <Badge variant={item.activo ? "success" : "neutral"}>
              {item.activo ? "Activo" : "Inactivo"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Eliminar ${item.nombre}`}
              onClick={onDelete ? () => onDelete(item.id) : undefined}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" size="sm" onClick={onCreate}>
        <Plus className="size-4" aria-hidden="true" />
        Agregar item
      </Button>
    </div>
  );
}
