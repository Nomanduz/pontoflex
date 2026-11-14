import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fecharPeriodo } from "@/lib/fechamento.functions";
import { deslocarPeriodo, periodoDe, ultimoPeriodoFechavel } from "@/lib/escala";
import { dayKey, formatKey } from "@/lib/ponto";
import { statusFolha } from "@/lib/folha-status";

export const Route = createFileRoute("/_authenticated/admin/fechamento")({
  head: () => ({ meta: [{ title: "Fechamento de ponto — PontoFlex" }, { name: "description", content: "Fechamento mensal do ponto (21 a 20) e assinaturas." }, { property: "og:title", content: "Fechamento de ponto — PontoFlex" }, { property: "og:description", content: "Fechamento mensal do ponto (21 a 20) e assinaturas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Fechamento,
});

function Fechamento() {
  const qc = useQueryClient();
  const fechar = useServerFn(fecharPeriodo);
  const hoje = dayKey(new Date());
  const [inicio, setInicio] = useState(() => ultimoPeriodoFechavel(hoje).inicio);
  const { fim } = periodoDe(inicio);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["fechamento", inicio],
    queryFn: async () => {
      const [{ data: funcs }, { data: fcs }] = await Promise.all([
        supabase.from("funcionarios").select("id, nome").order("nome"),
        supabase.from("fechamentos").select("id, funcionario_id, func_assinado_em, empresa_assinado_em").eq("periodo_inicio", inicio),
      ]);
      return { funcs: funcs ?? [], fcs: new Map((fcs ?? []).map((f) => [f.funcionario_id, f])) };
    },
  });
  const podeFechar = fim < hoje;
  const fmt = (k: string) => formatKey(k, { day: "2-digit", month: "2-digit", year: "numeric" });

  async function onFechar() {
    setBusy(true);
    try {
      const r = await fechar({ data: { inicio } });
      toast.success(`${r.fechados} folha(s) fechada(s). Os funcionários já podem assinar.`);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao fechar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Fechamento de ponto</h1>
      <div className="flex items-center justify-between gap-2">
        <Button size="icon" variant="outline" aria-label="Período anterior" onClick={() => setInicio(deslocarPeriodo(inicio, -1).inicio)}><ChevronLeft /></Button>
        <span className="text-center font-medium">{fmt(inicio)} a {fmt(fim)}</span>
        <Button size="icon" variant="outline" aria-label="Próximo período" disabled={inicio >= periodoDe(hoje).inicio} onClick={() => setInicio(deslocarPeriodo(inicio, 1).inicio)}><ChevronRight /></Button>
      </div>
      <Button className="w-full sm:w-auto" disabled={!podeFechar || busy} onClick={onFechar}>
        <Lock className="size-4" /> {busy ? "Fechando…" : podeFechar ? "Fechar período" : "Período ainda em andamento"}
      </Button>
      <p className="text-xs text-muted-foreground">O fechamento gera a folha de cada funcionário. Folhas ainda não assinadas podem ser fechadas de novo para incluir correções.</p>
      <Card>
        <CardContent className="divide-y pt-4">
          {data?.funcs.map((f) => {
            const fc = data.fcs.get(f.id);
            const s = fc ? statusFolha(fc) : null;
            return (
              <div key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium">{f.nome}</span>
                {fc && s ? (
                  <div className="flex items-center gap-2">
                    <Badge variant={s.variant}>{s.label}</Badge>
                    <Button size="sm" variant="ghost" asChild><Link to="/folha/$id" params={{ id: fc.id }}>Ver</Link></Button>
                  </div>
                ) : <span className="text-muted-foreground">Não fechada</span>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
