"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/Dialog";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import { CurrencyDisplay } from "@/components/domain/CurrencyDisplay";
import { MonthCalendar } from "@/components/domain/MonthCalendar";
import { TaskChecklist } from "@/components/domain/TaskChecklist";
import { MenuBoard } from "@/components/domain/MenuBoard";
import { ItemAdicionalEditor } from "@/components/domain/ItemAdicionalEditor";
import { AccessLinkCard } from "@/components/domain/AccessLinkCard";
import { BirthdayBanner } from "@/components/domain/BirthdayBanner";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-md">
      <h2 className="text-h2 font-semibold text-foreground">{title}</h2>
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-lg">
        {children}
      </div>
    </section>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button variant="secondary" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Cambiar a modo {theme === "dark" ? "claro" : "oscuro"}
    </Button>
  );
}

const SAMPLE_DIAS = [
  { fecha: "2026-06-01", tipo: "TRABAJADO" as const },
  { fecha: "2026-06-02", tipo: "TRABAJADO" as const },
  { fecha: "2026-06-03", tipo: "INASISTENCIA" as const },
  { fecha: "2026-06-04", tipo: "TRABAJADO" as const, itemsAdicionales: ["i1"] },
  { fecha: "2026-06-05", tipo: "FESTIVO" as const },
  { fecha: "2026-06-06", tipo: "TRABAJADO" as const },
  { fecha: "2026-06-07", tipo: "NO_LABORAL" as const },
  { fecha: "2026-06-08", tipo: "TRABAJADO" as const },
  { fecha: "2026-06-20", tipo: "FUERA_CONTRATO" as const },
];

export function ComponentsShowcase() {
  const [editable, setEditable] = React.useState(true);
  return (
    <>
      <Section title="Button — variantes, tamaños y estados">
        <div className="flex flex-wrap items-center gap-sm">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <Button size="sm">Pequeño</Button>
          <Button size="md">Mediano</Button>
          <Button size="lg">Grande</Button>
          <Button disabled>Deshabilitado</Button>
          <Button loading>Cargando</Button>
        </div>
      </Section>

      <Section title="Inputs y formularios">
        <Input label="Nombre" placeholder="Ej. María" />
        <Input label="Salario base" currency placeholder="700000" helperText="En pesos (COP)." />
        <Input label="Email" error="Email inválido" defaultValue="malo@" />
        <Textarea label="Notas del mes (privadas)" placeholder="Escribe una nota…" />
        <div className="flex flex-wrap items-center gap-lg">
          <Checkbox label="Trapear el patio" />
          <Switch aria-label="Día laboral lunes" defaultChecked />
          <Select>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Periodicidad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SEMANAL">Semanal</SelectItem>
              <SelectItem value="QUINCENAL">Quincenal</SelectItem>
              <SelectItem value="MENSUAL">Mensual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Badges, Avatar, Tooltip">
        <div className="flex flex-wrap items-center gap-sm">
          <Badge variant="warning">Borrador</Badge>
          <Badge variant="success">Cerrada</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="accent">Cumpleaños</Badge>
          <Avatar>
            <AvatarFallback>MR</AvatarFallback>
          </Avatar>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm">
                  ¿Festivos?
                </Button>
              </TooltipTrigger>
              <TooltipContent>Los festivos no se descuentan.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Section>

      <Section title="Card, desglose y montos (CurrencyDisplay)">
        <Card variant="highlight">
          <CardHeader>
            <CardTitle>Total a pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay amount={1742500} className="text-display text-primary" />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-xs text-body">
          <div className="flex justify-between">
            <span className="text-foreground-muted">Subtotal días</span>
            <CurrencyDisplay amount={1500000} />
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Items adicionales</span>
            <CurrencyDisplay amount={200000} />
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Montos puntuales</span>
            <CurrencyDisplay amount={42500} />
          </div>
        </div>
      </Section>

      <Section title="Tabs, Dialog, Toast, Skeleton, EmptyState">
        <Tabs defaultValue="pago">
          <TabsList>
            <TabsTrigger value="pago">Pago</TabsTrigger>
            <TabsTrigger value="menu">Menú</TabsTrigger>
            <TabsTrigger value="tareas">Tareas</TabsTrigger>
          </TabsList>
          <TabsContent value="pago">Contenido de Pago.</TabsContent>
          <TabsContent value="menu">Contenido de Menú.</TabsContent>
          <TabsContent value="tareas">Contenido de Tareas.</TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center gap-sm">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Eliminar liquidación</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Eliminar liquidación</DialogTitle>
              <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button variant="danger">Eliminar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="secondary" onClick={() => toast.success("Enlace copiado")}>
            Mostrar toast
          </Button>
        </div>
        <div className="flex flex-col gap-xs">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        <EmptyState
          title="Sin meses liquidados"
          description="Cuando liquides un mes, aparecerá aquí."
          action={<Button size="sm">Liquidar mes</Button>}
        />
      </Section>

      <Section title="Dominio — MonthCalendar">
        <MonthCalendar anio={2026} mes={6} dias={SAMPLE_DIAS} />
      </Section>

      <Section title="Dominio — TaskChecklist">
        <Checkbox
          label="Modo marcable (empleada)"
          checked={editable}
          onCheckedChange={(c) => setEditable(c === true)}
        />
        <TaskChecklist
          editable={editable}
          onToggle={(id, hecha) => toast.info(`${id}: ${hecha ? "hecha" : "pendiente"}`)}
          tareas={[
            { rutinaTareaId: "t1", descripcion: "Trapear", hecha: false, horaInicio: "08:00" },
            { rutinaTareaId: "t2", descripcion: "Lavar loza", hecha: true },
            { rutinaTareaId: "t3", descripcion: "Planchar", hecha: false },
          ]}
        />
      </Section>

      <Section title="Dominio — MenuBoard">
        <MenuBoard
          comidas={["Desayuno", "Almuerzo", "Cena"]}
          diaHoy="MIERCOLES"
          entradas={[
            { semana: 0, diaSemana: "LUNES", comida: "Almuerzo", descripcion: "Frijoles" },
            { semana: 0, diaSemana: "MIERCOLES", comida: "Almuerzo", descripcion: "Sancocho" },
            { semana: 0, diaSemana: "MIERCOLES", comida: "Desayuno", descripcion: "Arepa" },
          ]}
        />
      </Section>

      <Section title="Dominio — ItemAdicionalEditor, AccessLinkCard, BirthdayBanner">
        <ItemAdicionalEditor
          items={[
            { id: "i1", nombre: "Noche", valorUnitario: 30000, color: "#DB2777", activo: true },
            { id: "i2", nombre: "Domingo", valorUnitario: 50000, color: "#7C3AED", activo: false },
          ]}
          onCreate={() => toast.info("Crear item")}
        />
        <AccessLinkCard
          url="https://miempleadapp.co/consulta/abc123token"
          activo
          onCopy={() => toast.success("Enlace copiado")}
        />
        <BirthdayBanner nombre="María" cuando="¡Hoy!" />
      </Section>
    </>
  );
}
