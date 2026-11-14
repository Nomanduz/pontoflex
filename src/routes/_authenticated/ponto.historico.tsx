import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FolhaTabela } from "@/components/FolhaTabela";
import { deslocarPeriodo, montarFolha, periodoDe, type EscalaCfg } from "@/lib/escala";
import { dayKey, formatKey } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/ponto/historico")({
  head: () => ({
    meta: [
      { title: "Meu espelho de ponto — PontoFlex" },
      { name: "description", content: "Espelho de ponto do período (21 a 20) e banco de horas." },
      { property: "og:title", content: "Meu espelho de ponto — PontoFlex" },
      {
        property: "og:description",
        content: "Espelho de ponto do período (21 a 20) e banco de horas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historico,
});

function Historico() {
  const [inicio, setInicio] = useState(() => periodoDe(dayKey(new Date())).inicio);
  const { fim } = periodoDe(inicio);
  const { data } = useQuery({
    queryKey: ["historico", inicio],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: f } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      const ate = new Date(Date.parse(`${fim}T00:00:00-03:00`) + 2 * 864e5).toISOString();
      const { data: pts } = await supabase
        .from("pontos")
        .select("tipo, data_hora")
        .gte("data_hora", `${inicio}T00:00:00-03:00`)
        .lt("data_hora", ate)
        .order("data_hora");
      return f ? montarFolha(f as EscalaCfg, pts ?? [], inicio, fim) : null;
    },
  });
  const atual = inicio === periodoDe(dayKey(new Date())).inicio;
  const fmt = (k: string) => formatKey(k, { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-bold">Espelho de ponto</h1>
      <div className="flex items-center justify-between">
        <Button
          size="icon"
          variant="outline"
          aria-label="Período anterior"
          onClick={() => setInicio(deslocarPeriodo(inicio, -1).inicio)}
        >
          <ChevronLeft />
        </Button>
        <span className="font-medium">
          {fmt(inicio)} a {fmt(fim)}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Próximo período"
          disabled={atual}
          onClick={() => setInicio(deslocarPeriodo(inicio, 1).inicio)}
        >
          <ChevronRight />
        </Button>
      </div>
      <Card>
        <CardContent className="pt-4">
          {data ? (
            <FolhaTabela folha={data} />
          ) : (
            <p className="text-muted-foreground">Carregando…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
