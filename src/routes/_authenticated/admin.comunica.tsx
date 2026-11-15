import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FiltroDepartamento } from "@/components/FiltroDepartamento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/comunica")({
  head: () => ({ meta: [{ title: "Comunica RH — PontoFlex" }] }),
  component: ComunicaEmpresa,
});

const quando = (t: string) =>
  new Date(t).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function ComunicaEmpresa() {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [depto, setDepto] = useState("todos");
  const [importante, setImportante] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["comunicados-empresa"],
    queryFn: async () => {
      const [{ data: com }, { data: leit }, { data: funcs }] = await Promise.all([
        supabase
          .from("comunicados")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("comunicados_leitura").select("comunicado_id, funcionario_id, lido_em"),
        supabase.from("funcionarios").select("id, nome, departamento").eq("ativo", true),
      ]);
      return { com: com ?? [], leit: leit ?? [], funcs: funcs ?? [] };
    },
  });

  async function publicar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: emp } = await supabase.from("empresas").select("id").maybeSingle();
      const { error } = await supabase.from("comunicados").insert({
        empresa_id: emp!.id,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        departamento: depto === "todos" ? null : depto,
        importante,
      });
      if (error) throw new Error("Não foi possível publicar");
      toast.success("Comunicado publicado");
      setTitulo("");
      setMensagem("");
      setImportante(false);
      qc.invalidateQueries({ queryKey: ["comunicados-empresa"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este comunicado? As confirmações de leitura também serão apagadas."))
      return;
    const { error } = await supabase.from("comunicados").delete().eq("id", id);
    if (error) toast.error("Não foi possível excluir");
    else qc.invalidateQueries({ queryKey: ["comunicados-empresa"] });
  }

  return (
    <>
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Megaphone className="size-6" /> Comunica RH
      </h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Novo comunicado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={publicar} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="titulo">Título</Label>
              <Input
                id="titulo"
                required
                maxLength={120}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Expediente no feriado de 20/11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="msg">Mensagem</Label>
              <Textarea
                id="msg"
                required
                maxLength={4000}
                rows={5}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <FiltroDepartamento
                valor={depto}
                onChange={setDepto}
                label="Para quem"
                todosLabel="Todos os funcionários"
              />
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={importante} onCheckedChange={(v) => setImportante(v === true)} />
                Importante (pede “li e estou ciente”)
              </label>
            </div>
            <Button type="submit" disabled={busy}>
              <Send className="size-4" /> Publicar
            </Button>
            <p className="text-xs text-muted-foreground">
              O comunicado aparece na aba Comunica RH do app de cada funcionário, que confirma a
              leitura. Não inclua dados pessoais de outros funcionários.
            </p>
          </form>
        </CardContent>
      </Card>

      {data?.com.map((c) => {
        const alvo = data.funcs.filter((f) => !c.departamento || f.departamento === c.departamento);
        const leram = data.leit.filter((l) => l.comunicado_id === c.id);
        const idsLeram = new Set(leram.map((l) => l.funcionario_id));
        const faltam = alvo.filter((f) => !idsLeram.has(f.id));
        return (
          <Card key={c.id}>
            <CardContent className="space-y-2 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {c.importante && <Badge variant="destructive">Importante</Badge>}
                  <Badge variant="outline">{c.departamento ?? "Todos"}</Badge>
                  <span className="text-xs text-muted-foreground">{quando(c.created_at)}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir"
                  onClick={() => excluir(c.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <h2 className="font-display text-lg font-bold">{c.titulo}</h2>
              <p className="whitespace-pre-line text-sm">{c.mensagem}</p>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => setAberto(aberto === c.id ? null : c.id)}
              >
                Lido por {Math.min(leram.length, alvo.length)} de {alvo.length}
              </button>
              {aberto === c.id && faltam.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ainda não leram: {faltam.map((f) => f.nome).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
