import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMeuFuncionario } from "@/hooks/use-meu-funcionario";
import { useComunicados } from "@/hooks/use-comunicados";

export const Route = createFileRoute("/_authenticated/ponto/comunica")({
  head: () => ({ meta: [{ title: "Comunica RH — PontoFlex" }] }),
  component: ComunicaRH,
});

const quando = (t: string) =>
  new Date(t).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ComunicaRH() {
  const qc = useQueryClient();
  const { data: cad } = useMeuFuncionario();
  const { data } = useComunicados();

  async function marcarLido(id: string) {
    if (!cad?.f) return;
    const { error } = await supabase
      .from("comunicados_leitura")
      .insert({ comunicado_id: id, funcionario_id: cad.f.id });
    if (error && error.code !== "23505") toast.error("Não foi possível registrar a leitura");
    qc.invalidateQueries({ queryKey: ["comunicados-func"] });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
        <Megaphone className="size-6" /> Comunica RH
      </h1>
      {data?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum comunicado da empresa ainda.</p>
      )}
      {data?.map((c) => (
        <Card key={c.id} className={!c.lido_em ? "border-primary" : ""}>
          <CardContent className="space-y-2 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              {c.importante && <Badge variant="destructive">Importante</Badge>}
              {!c.lido_em && <Badge>Novo</Badge>}
              {c.departamento && <Badge variant="outline">{c.departamento}</Badge>}
              <span className="text-xs text-muted-foreground">{quando(c.created_at)}</span>
            </div>
            <h2 className="font-display text-lg font-bold">{c.titulo}</h2>
            <p className="whitespace-pre-line text-sm">{c.mensagem}</p>
            {c.lido_em ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3" /> Ciente em {quando(c.lido_em)}
              </p>
            ) : (
              <Button size="sm" onClick={() => marcarLido(c.id)}>
                <CheckCircle2 className="size-4" />{" "}
                {c.importante ? "Li e estou ciente" : "Marcar como lido"}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
