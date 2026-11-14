import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatKey } from "@/lib/ponto";
import { statusFolha } from "@/lib/folha-status";

export const Route = createFileRoute("/_authenticated/ponto/folhas")({
  head: () => ({ meta: [{ title: "Folhas para assinar — PontoFlex" }, { name: "description", content: "Folhas de ponto fechadas para conferência e assinatura." }, { property: "og:title", content: "Folhas para assinar — PontoFlex" }, { property: "og:description", content: "Folhas de ponto fechadas para conferência e assinatura." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Folhas,
});

function Folhas() {
  const { data } = useQuery({
    queryKey: ["minhas-folhas"],
    queryFn: async () => (await supabase.from("fechamentos").select("id, periodo_inicio, periodo_fim, func_assinado_em, empresa_assinado_em").order("periodo_inicio", { ascending: false })).data ?? [],
  });
  const fmt = (k: string) => formatKey(k, { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Folhas de ponto</h1>
      {data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma folha fechada ainda. A empresa fecha o período após o dia 20.</p>}
      {data?.map((f) => {
        const s = statusFolha(f);
        return (
          <Link key={f.id} to="/folha/$id" params={{ id: f.id }}>
            <Card className="mb-3 transition-colors hover:border-primary">
              <CardContent className="flex items-center justify-between pt-4 text-sm">
                <span className="font-medium">{fmt(f.periodo_inicio)} a {fmt(f.periodo_fim)}</span>
                <Badge variant={s.variant}>{f.func_assinado_em ? s.label : "Assinar"}</Badge>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
