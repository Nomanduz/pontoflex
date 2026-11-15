import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CampoData, CampoHora } from "@/components/CampoDataHora";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { solicitarAjuste } from "@/lib/conta.functions";
import { formatDate, formatTime, TIPOS, TIPO_LABEL, type Tipo } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/ponto/ajustes")({
  head: () => ({
    meta: [
      { title: "Solicitar ajuste de ponto — PontoFlex" },
      {
        name: "description",
        content: "Peça o lançamento de uma marcação esquecida para aprovação da empresa.",
      },
      { property: "og:title", content: "Solicitar ajuste de ponto — PontoFlex" },
      {
        property: "og:description",
        content: "Peça o lançamento de uma marcação esquecida para aprovação da empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ajustes,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

function getPos(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no-geo"));
    navigator.geolocation.getCurrentPosition(res, rej, {
      enableHighAccuracy: true,
      timeout: 15000,
    });
  });
}

function Ajustes() {
  const qc = useQueryClient();
  const enviar = useServerFn(solicitarAjuste);
  const [tipo, setTipo] = useState<Tipo>("ENTRADA");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: lista } = useQuery({
    queryKey: ["minhas-solicitacoes"],
    queryFn: async () =>
      (
        await supabase
          .from("solicitacoes_ponto")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let pos: GeolocationPosition;
      try {
        pos = await getPos();
      } catch {
        toast.error("Permita o acesso à localização para enviar a solicitação.");
        return;
      }
      await enviar({
        data: {
          tipo,
          data_hora: `${data}T${hora}:00-03:00`,
          motivo,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      });
      toast.success("Solicitação enviada para aprovação do responsável.");
      setMotivo("");
      setHora("");
      qc.invalidateQueries({ queryKey: ["minhas-solicitacoes"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Ajustar ponto</h1>
      <p className="text-sm text-muted-foreground">
        Informe a marcação que faltou. Ela só entra no seu espelho depois que o setor responsável
        aprovar.
      </p>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>Marcação</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="d">Data</Label>
                <CampoData id="d" value={data} onChange={setData} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="h">Horário</Label>
                <CampoHora id="h" value={hora} onChange={setHora} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="m">Motivo</Label>
              <Textarea
                id="m"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: esqueci de registrar na saída do almoço"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Enviando…" : "Enviar para aprovação"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Minhas solicitações</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {lista?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>
          )}
          {lista?.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {TIPO_LABEL[s.tipo]} · {formatDate(s.data_hora)} {formatTime(s.data_hora)}
                </p>
                <p className="text-muted-foreground">{s.motivo}</p>
                {s.observacao && (
                  <p className="text-xs text-muted-foreground">Resposta: {s.observacao}</p>
                )}
              </div>
              <Badge
                variant={
                  s.status === "aprovado"
                    ? "default"
                    : s.status === "recusado"
                      ? "destructive"
                      : "secondary"
                }
              >
                {STATUS_LABEL[s.status]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
