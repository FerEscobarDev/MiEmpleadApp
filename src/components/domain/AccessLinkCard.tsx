import * as React from "react";
import { Copy, RefreshCw, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";

// AccessLinkCard del Design System (design_system.md §4 — AccessLinkCard).
// Muestra el enlace de acceso de la empleada con copiar/regenerar/revocar e
// indica si está activo. Shell por props (acciones cableadas en Milestone 8).
export interface AccessLinkCardProps {
  url: string;
  activo: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onRevoke?: () => void;
  className?: string;
}

export function AccessLinkCard({
  url,
  activo,
  onCopy,
  onRegenerate,
  onRevoke,
  className,
}: AccessLinkCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Enlace de acceso de la empleada</CardTitle>
        <Badge variant={activo ? "success" : "neutral"}>{activo ? "Activo" : "Revocado"}</Badge>
      </CardHeader>
      <CardContent>
        <p className="truncate rounded-md bg-surface-muted px-md py-sm text-caption text-foreground-muted">
          {url}
        </p>
      </CardContent>
      <CardFooter className="flex-wrap">
        <Button variant="secondary" size="sm" onClick={onCopy} disabled={!activo}>
          <Copy className="size-4" aria-hidden="true" />
          Copiar
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Regenerar
        </Button>
        <Button variant="danger" size="sm" onClick={onRevoke} disabled={!activo}>
          <Ban className="size-4" aria-hidden="true" />
          Revocar
        </Button>
      </CardFooter>
    </Card>
  );
}
