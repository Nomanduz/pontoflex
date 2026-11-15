import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GuardaSessao } from "@/components/GuardaSessao";
import { Button } from "@/components/ui/button";
import { darCienciaFerias } from "@/lib/perfil.functions";
import { somarDias } from "@/lib/vinculo";

export const Route = createFileRoute("/_authenticated/ferias/aviso/$id")({
  head: () => ({ meta: [{ title: "Aviso de férias — PontoFlex" }] }),
  component: AvisoFerias,
});

const br = (k: string | null | undefined) => (k ? k.split("-").reverse().join("/") : "—");
const dataHora = (t: string) =>
  new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

/** Aviso de férias (CLT art. 135): comunicado por escrito com 30 dias de antecedência. */
function AvisoFerias() {
  const { id } = Route.useParams();
  const { papel } = Route.useRouteContext();
  const router = useRouter();
  const ciencia = useServerFn(darCienciaFerias);
  const [busy, setBusy] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["aviso-ferias", id],
    queryFn: async () => {
      const { data: x } = await supabase.from("ferias").select("*").eq("id", id).maybeSingle();
      if (!x) return null;
      const [{ data: f }, { data: emp }] = await Promise.all([
        supabase
          .from("funcionarios")
          .select("nome, cpf, matricula, cargo, departamento, data_admissao")
          .eq("id", x.funcionario_id)
          .maybeSingle(),
        supabase.from("empresas").select("razao_social, documento, tipo_documento").maybeSingle(),
      ]);
      return { x, f, emp };
    },
  });

  if (data === undefined) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (!data?.f) return <p className="p-6 text-sm">Aviso não encontrado.</p>;
  const { x, f, emp } = data;
  const fim = somarDias(x.inicio, x.dias - 1);
  const retorno = somarDias(fim, 1);
  const pagamentoAte = somarDias(x.inicio, -2);
  const avisoEm = x.created_at.slice(0, 10);

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 md:p-8">
      <GuardaSessao papel={papel} />
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => router.history.back()}>
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / salvar PDF
        </Button>
      </div>

      <article className="space-y-4 rounded-xl border bg-card p-6 text-sm leading-relaxed print:border-0 print:p-0">
        <header className="border-b pb-3">
          <p className="font-bold">{emp?.razao_social}</p>
          <p>
            {emp?.tipo_documento}: {emp?.documento}
          </p>
        </header>
        <h1 className="text-center font-display text-xl font-bold">AVISO DE FÉRIAS</h1>
        <p>
          <strong>Empregado(a):</strong> {f.nome} · CPF {f.cpf} · Matrícula {f.matricula}
          {f.cargo ? ` · ${f.cargo}` : ""}
          {f.departamento ? ` · ${f.departamento}` : ""}
          {f.data_admissao ? ` · Admissão ${br(f.data_admissao)}` : ""}
        </p>
        <p>
          Nos termos do art. 135 da CLT, comunicamos que suas férias referentes ao período
          aquisitivo de <strong>{br(x.aquisitivo_inicio)}</strong> a{" "}
          <strong>{br(x.aquisitivo_fim)}</strong> serão concedidas conforme abaixo:
        </p>
        <table className="w-full border text-left">
          <tbody>
            {[
              ["Início do descanso", br(x.inicio)],
              ["Término do descanso", br(fim)],
              ["Dias de descanso", String(x.dias)],
              ["Abono pecuniário (dias vendidos)", x.abono_dias ? String(x.abono_dias) : "Não"],
              ["Retorno ao trabalho", br(retorno)],
              ["Pagamento das férias + 1/3 até", br(pagamentoAte)],
            ].map(([k, v]) => (
              <tr key={k} className="border-t">
                <td className="p-2 text-muted-foreground">{k}</td>
                <td className="p-2 font-semibold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">
          O pagamento da remuneração das férias, acrescida de 1/3, será feito até 2 dias antes do
          início (CLT arts. 142 e 145). Aviso emitido em {br(avisoEm)}.
        </p>

        <div className="grid gap-8 pt-8 sm:grid-cols-2">
          <div className="border-t pt-1 text-center text-xs">
            {emp?.razao_social}
            <br />
            Empregador
          </div>
          <div className="border-t pt-1 text-center text-xs">
            {f.nome}
            <br />
            {x.ciente_em
              ? `Ciente pelo app em ${dataHora(x.ciente_em)}${x.ciente_ip ? ` (IP ${x.ciente_ip})` : ""}`
              : "Ciente em ____/____/______"}
          </div>
        </div>
      </article>

      {papel === "funcionario" && !x.ciente_em && (
        <div className="space-y-2 rounded-xl border-2 border-primary p-4 print:hidden">
          <p className="text-sm">
            Confira as datas. Ao confirmar, fica registrado que você recebeu este aviso (data, hora
            e endereço de internet).
          </p>
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await ciencia({ data: { id: x.id } });
                toast.success("Ciência registrada");
                refetch();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 className="size-4" /> Li e estou ciente
          </Button>
        </div>
      )}
    </main>
  );
}
