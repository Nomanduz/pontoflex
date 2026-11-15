import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExtratoBanco } from "@/components/ExtratoBanco";
import { Card, CardContent } from "@/components/ui/card";
import { useMeuFuncionario } from "@/hooks/use-meu-funcionario";
import { carregarMovimentos } from "@/lib/banco-horas-dados";
import { dayKey } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/ponto/banco")({
  head: () => ({ meta: [{ title: "Banco de horas — PontoFlex" }] }),
  component: MeuBanco,
});

function MeuBanco() {
  const { data: cad } = useMeuFuncionario();
  const id = cad?.f?.id;
  const { data } = useQuery({
    queryKey: ["meu-banco", id],
    enabled: !!id,
    queryFn: async () => (await carregarMovimentos([id!])).get(id!) ?? [],
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-bold">Banco de horas</h1>
      <Card>
        <CardContent className="pt-6">
          {data ? (
            <ExtratoBanco
              movimentos={data}
              prazoMeses={cad?.emp?.banco_horas_meses ?? 6}
              hoje={dayKey(new Date())}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
