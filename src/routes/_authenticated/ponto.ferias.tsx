import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, CheckCircle2, FileText, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useMeuFuncionario } from "@/hooks/use-meu-funcionario";
import { periodosAquisitivos, SITUACAO_LABEL } from "@/lib/ferias";
import { dayKey } from "@/lib/ponto";
import { diasEntre, somarDias, TIPOS_AFASTAMENTO, type TipoAfastamento } from "@/lib/vinculo";

export const Route = createFileRoute("/_authenticated/ponto/ferias")({
  head: () => ({ meta: [{ title: "Férias e afastamentos — PontoFlex" }] }),
  component: MinhasFerias,
});

const br = (k: string) => k.split("-").reverse().join("/");

function MinhasFerias() {
  const hoje = dayKey(new Date());
  const { data: cad } = useMeuFuncionario();
  const { data } = useQuery({
    queryKey: ["minhas-ferias"],
    queryFn: async () => {
      const [{ data: ferias }, { data: afast }] = await Promise.all([
        supabase.from("ferias").select("*").order("inicio", { ascending: false }),
        supabase.from("afastamentos").select("*").order("inicio", { ascending: false }),
      ]);
      return { ferias: ferias ?? [], afast: afast ?? [] };
    },
  });
  const f = cad?.f;
  const periodos =
    f?.data_admissao && data
      ? periodosAquisitivos({
          admissao: f.data_admissao,
          hoje,
          desligamento: f.data_desligamento,
          lancadas: data.ferias,
        })
      : [];
  const atual =
    periodos.find((p) => p.situacao !== "em_aquisicao" && p.saldo > 0) ?? periodos.at(-1);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl font-bold">Férias e afastamentos</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarHeart className="size-5" /> Minhas férias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!f?.data_admissao && (
            <p className="text-muted-foreground">O RH ainda não informou sua data de admissão.</p>
          )}
          {atual && (
            <div className="rounded-lg bg-primary/5 p-3">
              <p>
                Período {br(atual.inicio)} a {br(atual.fim)}: <strong>{atual.saldo} dias</strong>{" "}
                disponíveis
                {atual.situacao === "em_aquisicao"
                  ? " (em aquisição: liberado após completar 12 meses)"
                  : `, a conceder até ${br(atual.limiteConcessao)}`}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                A data das férias é definida pela empresa (CLT art. 136) e avisada com 30 dias de
                antecedência.
              </p>
            </div>
          )}
          {data?.ferias.length === 0 && (
            <p className="text-muted-foreground">Nenhuma férias programada.</p>
          )}
          {data?.ferias.map((x) => (
            <div
              key={x.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
            >
              <div>
                <p className="font-medium">
                  {br(x.inicio)} a {br(somarDias(x.inicio, x.dias - 1))} · {x.dias} dias
                  {x.abono_dias ? ` + ${x.abono_dias} vendidos` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {x.inicio > hoje ? `Começa em ${diasEntre(hoje, x.inicio)} dia(s)` : "Concedidas"}
                  {x.ciente_em ? " · ciência confirmada" : ""}
                </p>
              </div>
              <Button size="sm" variant={x.ciente_em ? "outline" : "default"} asChild>
                <Link to="/ferias/aviso/$id" params={{ id: x.id }}>
                  {x.ciente_em ? (
                    <FileText className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  {x.ciente_em ? "Ver aviso" : "Ver e confirmar aviso"}
                </Link>
              </Button>
            </div>
          ))}
          {periodos.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Todos os períodos
              </summary>
              <div className="mt-2 space-y-1">
                {[...periodos].reverse().map((p) => (
                  <p key={p.inicio} className="flex justify-between text-xs">
                    <span>
                      {br(p.inicio)} a {br(p.fim)} · saldo {p.saldo}
                    </span>
                    <Badge variant="outline">{SITUACAO_LABEL[p.situacao]}</Badge>
                  </p>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-5" /> Afastamentos e licenças
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data?.afast.length === 0 && <p className="text-muted-foreground">Nenhum afastamento.</p>}
          {data?.afast.map((a) => (
            <p key={a.id} className="border-t pt-2 first:border-0 first:pt-0">
              <strong>{TIPOS_AFASTAMENTO[a.tipo as TipoAfastamento] ?? a.tipo}</strong> ·{" "}
              {br(a.inicio)} a {br(a.fim)} ({diasEntre(a.inicio, a.fim) + 1} dias)
            </p>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link to="/ponto/atestados">Enviar atestado</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
