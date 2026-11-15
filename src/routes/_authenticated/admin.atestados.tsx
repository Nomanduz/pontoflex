import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { analisarAtestado } from "@/lib/perfil.functions";
import { diasEntre } from "@/lib/vinculo";

export const Route = createFileRoute("/_authenticated/admin/atestados")({
  head: () => ({ meta: [{ title: "Atestados — PontoFlex" }] }),
  component: AtestadosEmpresa,
});

const br = (k: string) => k.split("-").reverse().join("/");

function AtestadosEmpresa() {
  const qc = useQueryClient();
  const analisar = useServerFn(analisarAtestado);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["atestados-empresa"],
    queryFn: async () => {
      const [{ data: a }, { data: f }] = await Promise.all([
        supabase.from("atestados").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("funcionarios").select("id, nome"),
      ]);
      const nomes = new Map((f ?? []).map((x) => [x.id, x.nome]));
      return (a ?? []).map((x) => ({ ...x, nome: nomes.get(x.funcionario_id) ?? "—" }));
    },
  });

  async function abrir(path: string) {
    const { data: u } = await supabase.storage.from("atestados").createSignedUrl(path, 120);
    if (u?.signedUrl) window.open(u.signedUrl, "_blank", "noopener");
    else toast.error("Arquivo indisponível");
  }

  async function decidir(id: string, aprovar: boolean) {
    setBusy(id);
    try {
      await analisar({ data: { id, aprovar, resposta: respostas[id] ?? "" } });
      toast.success(
        aprovar ? "Atestado aceito: dias lançados como afastamento" : "Atestado recusado",
      );
      qc.invalidateQueries({ queryKey: ["atestados-empresa"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  const pendentes = data?.filter((a) => a.status === "pendente") ?? [];
  const analisados = data?.filter((a) => a.status !== "pendente") ?? [];

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Atestados</h1>
      <p className="text-sm text-muted-foreground">
        Enviados pelos funcionários no app. Ao aceitar, os dias entram como afastamento e deixam de
        contar como falta. Dado de saúde: não copie o arquivo para fora do sistema sem necessidade
        (LGPD).
      </p>
      {pendentes.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum atestado aguardando análise.</p>
      )}
      {pendentes.map((a) => (
        <Card key={a.id} className="border-primary">
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                to="/admin/funcionario/$id"
                params={{ id: a.funcionario_id }}
                className="font-semibold hover:underline"
              >
                {a.nome}
              </Link>
              <span className="text-sm">
                {br(a.inicio)} a {br(a.fim)} ({diasEntre(a.inicio, a.fim) + 1} dia(s))
              </span>
            </div>
            {a.observacao && <p className="text-sm text-muted-foreground">“{a.observacao}”</p>}
            <Button size="sm" variant="outline" onClick={() => abrir(a.arquivo_path)}>
              <ExternalLink className="size-4" /> Ver arquivo
            </Button>
            <Input
              placeholder="Resposta ao funcionário (obrigatória para recusar)"
              maxLength={300}
              value={respostas[a.id] ?? ""}
              onChange={(e) => setRespostas({ ...respostas, [a.id]: e.target.value })}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === a.id} onClick={() => decidir(a.id, true)}>
                <Check className="size-4" /> Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === a.id}
                onClick={() => decidir(a.id, false)}
              >
                <X className="size-4" /> Recusar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {analisados.length > 0 && (
        <Card>
          <CardContent className="divide-y pt-4 text-sm">
            {analisados.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{a.nome}</strong> · {br(a.inicio)} a {br(a.fim)}
                  {a.resposta && <span className="text-muted-foreground"> · {a.resposta}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={a.status === "aprovado" ? "default" : "destructive"}>
                    {a.status === "aprovado" ? "Aceito" : "Recusado"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ver arquivo"
                    onClick={() => abrir(a.arquivo_path)}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
