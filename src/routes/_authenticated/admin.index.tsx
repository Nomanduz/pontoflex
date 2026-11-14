import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatTime, groupByDay, presenca, startOfDay, TIPO_LABEL, workedMs, type Tipo } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Dashboard — PontoFlex" }, { name: "description", content: "Indicadores de presença da empresa." }, { property: "og:title", content: "Dashboard — PontoFlex" }, { property: "og:description", content: "Indicadores de presença da empresa." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [{ data: funcs }, { data: pts }] = await Promise.all([
        supabase.from("funcionarios").select("id, nome, ativo"),
        supabase
          .from("pontos")
          .select("id, funcionario_id, tipo, data_hora")
          .gte("data_hora", startOfDay().toISOString())
          .order("data_hora", { ascending: false }),
      ]);
      return { funcs: funcs ?? [], pts: pts ?? [] };
    },
  });
  if (isLoading || !data) return <p className="text-muted-foreground">Carregando…</p>;
  const p = presenca(data.funcs, data.pts as { funcionario_id: string; tipo: Tipo }[]);
  const porFunc = new Map<string, { tipo: Tipo; data_hora: string }[]>();
  for (const pt of data.pts) {
    if (!porFunc.has(pt.funcionario_id)) porFunc.set(pt.funcionario_id, []);
    porFunc.get(pt.funcionario_id)!.push(pt);
  }
  let horas = 0;
  for (const l of porFunc.values()) for (const d of groupByDay(l).values()) horas += workedMs(d);
  const nome = new Map(data.funcs.map((f) => [f.id, f.nome]));

  const cards = [
    ["Funcionários cadastrados", p.total],
    ["Presentes hoje", p.presentes],
    ["Ausentes hoje", p.ausentes],
    ["Horas trabalhadas hoje", formatDuration(horas)],
  ] as const;

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, v]) => (
          <Card key={t}>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{t}</CardTitle></CardHeader>
            <CardContent className="font-display text-3xl font-bold text-primary">{v}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Últimas marcações de hoje</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data.pts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma marcação hoje.</p>}
          {data.pts.slice(0, 10).map((pt) => (
            <div key={pt.id} className="flex justify-between py-2 text-sm">
              <span>{nome.get(pt.funcionario_id) ?? "—"} · <span className="text-muted-foreground">{TIPO_LABEL[pt.tipo]}</span></span>
              <span className="font-mono font-semibold">{formatTime(pt.data_hora)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
