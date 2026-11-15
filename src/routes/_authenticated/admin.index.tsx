import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { alertasContrato } from "@/lib/vinculo";
import { alertasFerias, periodosAquisitivos } from "@/lib/ferias";
import { dayKey as hojeKey } from "@/lib/ponto";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDuration,
  formatTime,
  groupByDay,
  presenca,
  startOfDay,
  TIPO_LABEL,
  workedMs,
  type Tipo,
} from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PontoFlex" },
      { name: "description", content: "Indicadores de presença da empresa." },
      { property: "og:title", content: "Dashboard — PontoFlex" },
      { property: "og:description", content: "Indicadores de presença da empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
      <AvisosRH />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, v]) => (
          <Card key={t}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{t}</CardTitle>
            </CardHeader>
            <CardContent className="font-display text-3xl font-bold text-primary">{v}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Últimas marcações de hoje</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data.pts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma marcação hoje.</p>
          )}
          {data.pts.slice(0, 10).map((pt) => (
            <div key={pt.id} className="flex justify-between py-2 text-sm">
              <span>
                {nome.get(pt.funcionario_id) ?? "—"} ·{" "}
                <span className="text-muted-foreground">{TIPO_LABEL[pt.tipo]}</span>
              </span>
              <span className="font-mono font-semibold">{formatTime(pt.data_hora)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

/** Contratos de experiência/temporários terminando e férias perto de vencer. */
function AvisosRH() {
  const { data } = useQuery({
    queryKey: ["avisos-rh"],
    queryFn: async () => {
      const hoje = hojeKey(new Date());
      const [{ data: funcs }, { data: ferias }] = await Promise.all([
        supabase.from("funcionarios").select("*").eq("ativo", true).is("data_desligamento", null),
        supabase
          .from("ferias")
          .select("funcionario_id, aquisitivo_inicio, inicio, dias, abono_dias"),
      ]);
      const out: { id: string; nome: string; nivel: string; texto: string }[] = [];
      for (const f of funcs ?? []) {
        const alertas = [...alertasContrato(f, hoje)];
        if (f.data_admissao)
          alertas.push(
            ...alertasFerias(
              periodosAquisitivos({
                admissao: f.data_admissao,
                hoje,
                lancadas: (ferias ?? []).filter((x) => x.funcionario_id === f.id),
              }),
            ),
          );
        else
          alertas.push({
            nivel: "info",
            texto: "Cadastre a data de admissão (usada no espelho e nas férias).",
          });
        for (const a of alertas) out.push({ id: f.id, nome: f.nome, ...a });
      }
      const ordem: Record<string, number> = { urgente: 0, atencao: 1, info: 2 };
      return out.sort((a, b) => (ordem[a.nivel] ?? 3) - (ordem[b.nivel] ?? 3));
    },
  });
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-5 text-amber-600" /> Avisos de RH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.slice(0, 12).map((a, i) => (
          <Link
            key={i}
            to="/admin/funcionario/$id"
            params={{ id: a.id }}
            className={`block rounded-md p-2 text-sm hover:bg-muted ${a.nivel === "urgente" ? "text-destructive" : a.nivel === "atencao" ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}`}
          >
            <strong>{a.nome}:</strong> {a.texto}
          </Link>
        ))}
        {data.length > 12 && (
          <p className="text-xs text-muted-foreground">
            + {data.length - 12} aviso(s) na lista de funcionários.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
