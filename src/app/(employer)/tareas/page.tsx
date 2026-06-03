import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { RutinaSection } from "./rutina-section";
import { ChecklistSection } from "./checklist-section";
import { HistoricoSection } from "./historico-section";

// Página /tareas (navigation_map.md §`/tareas`, HU-23/24/25/26), dentro del grupo
// protegido `(employer)` ⇒ detrás del SessionGuard y el shell del empleador (RN-13).
// Reúne el editor de rutina por día, el checklist del día (marcable) y el histórico
// de cumplimiento. La I/O con el backend ocurre en las secciones cliente, solo por
// el cliente tipado.
export default function TareasPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-lg">
      <header className="flex flex-col gap-xs">
        <h1 className="text-h1 font-bold text-foreground">Tareas</h1>
        <p className="text-body text-foreground-muted">
          Define la rutina de tareas por día de la semana, revisa el checklist del día
          y consulta el histórico de cumplimiento.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Rutina por día</CardTitle>
        </CardHeader>
        <CardContent>
          <RutinaSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cumplimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="hoy">
            <TabsList>
              <TabsTrigger value="hoy">Hoy</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="hoy">
              <ChecklistSection />
            </TabsContent>
            <TabsContent value="historico">
              <HistoricoSection />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
