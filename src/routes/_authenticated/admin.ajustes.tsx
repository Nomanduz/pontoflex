import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analisarSolicitacao } from "@/lib/conta.functions";
import { formatDate, formatTime, TIPO_LABEL } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/admin/ajustes")({
  head: () => ({ meta: [{ title: "Ajustes de ponto — PontoFlex" }, { name: "description", content: "Aprove ou recuse marcações lançadas posteriormente pelos funcionários." }, { property: "og:title", content: "Ajustes de ponto — PontoFlex" }, { property: "og:description", content: "Aprove ou recuse marcações lançadas posteriormente pelos funcionários." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminAjustes,
});

const STATUS_LABEL: Record<string, string> = { pendente: "Aguardando", aprovado: "Aprovado", recusado: "Recusado" };

function AdminAjustes() {
  const qc = useQueryClient();
  const analisar = useServerFn(analisarSolicitacao);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-solicitacoes"],
    queryFn: async () => {
      const [{ data: s }, { data: f }] = await Promise.all([
        supabase.from("solicitacoes_ponto").select("*").order("status").order("created_at", { ascending: false }).limit(100),
        supabase.from("funcionarios").select("id, nome, matricula"),
      ]);
      const nomes = new Map((f ?? []).map((x) => [x.id, `${x.nome} (${x.matricula ?? "—"})`]));
      return (s ?? []).map((x) => ({ ...x, nome: nomes.get(x.funcionario_id) ?? "—" }));
    },
  });

  async function decidir(id: string, aprovar: boolean) {
    setBusy(id);
    try {
      const o = obs[id]?.trim();
      await analisar({ data: { id, aprovar, ...(o ? { observacao: o } : {}) } });
      toast.success(aprovar ? "Marcação lançada no ponto do funcionário." : "Solicitação recusada.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Ajustes de ponto</h1>
      <p className="text-sm text-muted-foreground">Marcações que os funcionários esqueceram de registrar. Ao aprovar, ela entra no espelho marcada como ajuste autorizado.</p>
      <Card>
        <CardContent className="divide-y pt-4">
          {data?.length === 0 && <p className="py-2 text-sm text-muted-foreground">Nenhuma solicitação.</p>}
          {data?.map((s) => (
            <div key={s.id} className="space-y-2 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.nome}</p>
                  <p>{TIPO_LABEL[s.tipo]} · {formatDate(s.data_hora)} <b className="font-mono">{formatTime(s.data_hora)}</b></p>
                  <p className="text-muted-foreground">Motivo: {s.motivo}</p>
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}><MapPin className="size-3" /> Local do pedido</a>
                </div>
                <Badge variant={s.status === "aprovado" ? "default" : s.status === "recusado" ? "destructive" : "secondary"}>{STATUS_LABEL[s.status]}</Badge>
              </div>
              {s.status === "pendente" ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input placeholder="Observação (opcional)" value={obs[s.id] ?? ""} onChange={(e) => setObs({ ...obs, [s.id]: e.target.value })} />
                  <Button disabled={busy === s.id} onClick={() => decidir(s.id, true)}>Aprovar</Button>
                  <Button variant="outline" disabled={busy === s.id} onClick={() => decidir(s.id, false)}>Recusar</Button>
                </div>
              ) : s.observacao ? <p className="text-xs text-muted-foreground">Observação: {s.observacao}</p> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
