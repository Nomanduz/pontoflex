import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CampoData } from "@/components/CampoDataHora";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepararDocumento } from "@/lib/arquivo";
import { enviarAtestado } from "@/lib/perfil.functions";

export const Route = createFileRoute("/_authenticated/ponto/atestados")({
  head: () => ({ meta: [{ title: "Enviar atestado — PontoFlex" }] }),
  component: Atestados,
});

const br = (k: string) => k.split("-").reverse().join("/");
const STATUS: Record<string, { label: string; v: "secondary" | "default" | "destructive" }> = {
  pendente: { label: "Em análise", v: "secondary" },
  aprovado: { label: "Aceito", v: "default" },
  recusado: { label: "Recusado", v: "destructive" },
};

function Atestados() {
  const qc = useQueryClient();
  const enviar = useServerFn(enviarAtestado);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { data } = useQuery({
    queryKey: ["meus-atestados"],
    queryFn: async () =>
      (await supabase.from("atestados").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!arquivo) {
      toast.error("Tire uma foto do atestado ou escolha o arquivo");
      return;
    }
    if (!inicio || !fim) {
      toast.error("Informe os dias do atestado");
      return;
    }
    setBusy(true);
    try {
      await enviar({
        data: { inicio, fim, observacao: obs, arquivo: await prepararDocumento(arquivo) },
      });
      toast.success("Atestado enviado! O RH vai conferir.");
      setInicio("");
      setFim("");
      setObs("");
      setArquivo(null);
      if (input.current) input.current.value = "";
      qc.invalidateQueries({ queryKey: ["meus-atestados"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Enviar atestado</h1>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Primeiro dia</Label>
                <CampoData
                  value={inicio}
                  onChange={(v) => {
                    setInicio(v);
                    if (v && !fim) setFim(v);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Último dia</Label>
                <CampoData value={fim} onChange={setFim} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="arq">Foto ou PDF do atestado</Label>
              <Input
                id="arq"
                ref={input}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Input
                id="obs"
                maxLength={300}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <FileUp className="size-4" />} Enviar
              para o RH
            </Button>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              Só o RH da empresa vê o arquivo. Não é preciso informar diagnóstico. Entregue o
              original se a empresa pedir.
            </p>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Meus atestados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data?.length === 0 && <p className="text-muted-foreground">Nenhum atestado enviado.</p>}
          {data?.map((a) => (
            <div key={a.id} className="border-t pt-2 first:border-0 first:pt-0">
              <div className="flex items-center justify-between">
                <span>
                  {br(a.inicio)} a {br(a.fim)}
                </span>
                <Badge variant={STATUS[a.status]?.v ?? "secondary"}>
                  {STATUS[a.status]?.label ?? a.status}
                </Badge>
              </div>
              {a.resposta && <p className="text-xs text-muted-foreground">RH: {a.resposta}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
