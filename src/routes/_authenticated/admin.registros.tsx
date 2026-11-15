import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CampoData } from "@/components/CampoDataHora";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dayKey, formatDate, formatTime, TIPO_LABEL } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/admin/registros")({
  head: () => ({
    meta: [
      { title: "Registros de ponto — PontoFlex" },
      { name: "description", content: "Consulta de marcações por funcionário e período." },
      { property: "og:title", content: "Registros de ponto — PontoFlex" },
      { property: "og:description", content: "Consulta de marcações por funcionário e período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Registros,
});

function Registros() {
  const hoje = dayKey(new Date());
  const [func, setFunc] = useState("todos");
  const [de, setDe] = useState(dayKey(new Date(Date.now() - 7 * 864e5)));
  const [ate, setAte] = useState(hoje);

  const { data: funcs } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => (await supabase.from("funcionarios").select("*").order("nome")).data ?? [],
  });
  const { data: pts } = useQuery({
    queryKey: ["registros", func, de, ate],
    queryFn: async () => {
      let q = supabase
        .from("pontos")
        .select(
          "id, funcionario_id, tipo, data_hora, latitude, longitude, selfie_path, face_confianca",
        )
        .gte("data_hora", `${de}T00:00:00-03:00`)
        .lte("data_hora", `${ate}T23:59:59-03:00`)
        .order("data_hora", { ascending: false });
      if (func !== "todos") q = q.eq("funcionario_id", func);
      return (await q).data ?? [];
    },
  });
  const nome = new Map((funcs ?? []).map((f) => [f.id, f.nome]));

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Registros</h1>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Funcionário</Label>
          <Select value={func} onValueChange={setFunc}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {funcs?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>De</Label>
          <CampoData value={de} onChange={(v) => v && setDe(v)} aria-label="De" />
        </div>
        <div className="space-y-1">
          <Label>Até</Label>
          <CampoData value={ate} onChange={(v) => v && setAte(v)} aria-label="Até" />
        </div>
      </div>
      <Card>
        <CardContent className="divide-y pt-4">
          {pts?.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhuma marcação no período.</p>
          )}
          {pts?.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{nome.get(p.funcionario_id) ?? "—"}</p>
                <p className="text-muted-foreground">
                  {TIPO_LABEL[p.tipo]} · {formatDate(p.data_hora)}{" "}
                  <b className="font-mono text-foreground">{formatTime(p.data_hora)}</b>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {p.selfie_path && (
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={async () => {
                      const { data } = await supabase.storage
                        .from("faces")
                        .createSignedUrl(p.selfie_path!, 300);
                      if (data) window.open(data.signedUrl, "_blank");
                    }}
                  >
                    Selfie
                    {p.face_confianca != null
                      ? ` ${Math.round(Number(p.face_confianca) * 100)}%`
                      : ""}
                  </button>
                )}
                <a
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                >
                  <MapPin className="size-4" /> Mapa
                </a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
