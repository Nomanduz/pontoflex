import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarHeart,
  Lightbulb,
  Printer,
  Stethoscope,
  Trash2,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CampoData } from "@/components/CampoDataHora";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";
import { ESCALAS, montarFolha, type EscalaCfg } from "@/lib/escala";
import {
  alertasFerias,
  periodosAquisitivos,
  SITUACAO_LABEL,
  sugerirFerias,
  validarFerias,
  type PeriodoAquisitivo,
} from "@/lib/ferias";
import { desfazerDesligamento, desligarFuncionario } from "@/lib/funcionarios.functions";
import { dayKey } from "@/lib/ponto";
import {
  AFASTAMENTO_INJUSTIFICADO,
  alertasContrato,
  ausenciasDe,
  AVISOS_PREVIOS,
  diasAvisoPrevio,
  diasEntre,
  DIAS_PADRAO_AFASTAMENTO,
  fasesExperiencia,
  MOTIVOS_DESLIGAMENTO,
  somarDias,
  terminoPrevisto,
  TIPOS_AFASTAMENTO,
  TIPOS_CONTRATO,
  type Alerta,
  type AvisoPrevio,
  type MotivoDesligamento,
  type TipoAfastamento,
  type TipoContrato,
} from "@/lib/vinculo";

type Tabelas = Database["public"]["Tables"];
type Func = Tabelas["funcionarios"]["Row"];
type Afast = Tabelas["afastamentos"]["Row"];
type Ferias = Tabelas["ferias"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/funcionario/$id")({
  head: () => ({ meta: [{ title: "Ficha do funcionário — PontoFlex" }] }),
  component: Ficha,
});

const br = (k: string | null | undefined) => (k ? k.split("-").reverse().join("/") : "—");

/** Marcações em páginas de 1.000 (limite por consulta do banco). */
async function pontosEntre(funcId: string, de: string, ate: string) {
  const out: { tipo: string; data_hora: string }[] = [];
  const fimIso = new Date(Date.parse(`${ate}T00:00:00-03:00`) + 2 * 864e5).toISOString();
  for (let pag = 0; pag < 10; pag++) {
    const { data } = await supabase
      .from("pontos")
      .select("tipo, data_hora")
      .eq("funcionario_id", funcId)
      .gte("data_hora", `${de}T00:00:00-03:00`)
      .lt("data_hora", fimIso)
      .order("data_hora")
      .range(pag * 1000, pag * 1000 + 999);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) break;
  }
  return out as { tipo: "ENTRADA"; data_hora: string }[];
}

function Ficha() {
  const { id } = Route.useParams();
  const hoje = dayKey(new Date());
  const { data, refetch } = useQuery({
    queryKey: ["ficha", id],
    queryFn: async () => {
      const [f, emp, afast, ferias] = await Promise.all([
        supabase.from("funcionarios").select("*").eq("id", id).maybeSingle(),
        supabase.from("empresas").select("razao_social, documento, tipo_documento").maybeSingle(),
        supabase
          .from("afastamentos")
          .select("*")
          .eq("funcionario_id", id)
          .order("inicio", { ascending: false }),
        supabase
          .from("ferias")
          .select("*")
          .eq("funcionario_id", id)
          .order("inicio", { ascending: false }),
      ]);
      return {
        f: f.data as Func | null,
        emp: emp.data,
        afast: (afast.data ?? []) as Afast[],
        ferias: (ferias.data ?? []) as Ferias[],
      };
    },
  });

  // Faltas injustificadas por período aquisitivo (CLT art. 130), contadas a partir do dia em que
  // o funcionário entrou no PontoFlex — antes disso o app não tem os registros.
  const { data: faltas } = useQuery({
    queryKey: ["ficha-faltas", id, data?.f?.data_admissao, data?.afast.length, data?.ferias.length],
    enabled: !!data?.f?.data_admissao,
    queryFn: async () => {
      const f = data!.f!;
      const desdeApp = dayKey(new Date(f.created_at));
      const ontem = somarDias(hoje, -1);
      const periodos = periodosAquisitivos({ admissao: f.data_admissao!, hoje, lancadas: [] });
      const out: Record<string, number> = {};
      const justificadas = ausenciasDe(
        data!.afast.filter((a) => !AFASTAMENTO_INJUSTIFICADO.includes(a.tipo as TipoAfastamento)),
        data!.ferias,
      );
      for (const p of periodos.slice(-2)) {
        const de = [p.inicio, desdeApp].sort().at(-1)!;
        const ate = [p.fim, ontem, f.data_desligamento ?? p.fim].sort()[0]!;
        if (de > ate) continue;
        const pts = await pontosEntre(f.id, de, ate);
        const folha = montarFolha(f as EscalaCfg, pts, de, ate, new Date(), {
          ausencias: justificadas,
          admissao: f.data_admissao,
          desligamento: f.data_desligamento,
        });
        out[p.inicio] = folha.totais.faltas;
      }
      return out;
    },
  });

  if (!data) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!data.f) return <p className="text-sm">Funcionário não encontrado.</p>;
  const f = data.f;

  const periodos = f.data_admissao
    ? periodosAquisitivos({
        admissao: f.data_admissao,
        hoje,
        desligamento: f.data_desligamento,
        lancadas: data.ferias,
        faltas: faltas ?? {},
      })
    : [];
  const alertas: Alerta[] = [
    ...alertasContrato(f, hoje),
    ...(f.data_desligamento ? [] : alertasFerias(periodos)),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" asChild>
          <Link to="/admin/funcionarios">
            <ArrowLeft className="size-4" /> Funcionários
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir ficha
        </Button>
      </div>

      {/* Cabeçalho do documento impresso */}
      <div className="hidden text-sm print:block">
        <p className="font-bold">{data.emp?.razao_social}</p>
        <p>
          {data.emp?.tipo_documento}: {data.emp?.documento}
        </p>
        <p className="mt-2 text-lg font-bold">Ficha de registro do empregado (resumo)</p>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">{f.nome}</h1>
        <p className="text-sm text-muted-foreground">
          Matrícula {f.matricula} · {f.cargo || "sem cargo"} ·{" "}
          {f.data_desligamento ? "Desligado" : f.ativo ? "Ativo" : "Inativo"}
        </p>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-1 print:hidden">
          {alertas.map((a) => (
            <p
              key={a.texto}
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                a.nivel === "urgente"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {a.texto}
            </p>
          ))}
        </div>
      )}

      <DadosContrato f={f} hoje={hoje} />
      <FeriasCard
        f={f}
        periodos={periodos}
        ferias={data.ferias}
        hoje={hoje}
        onMudou={refetch}
        faltasProntas={!!faltas}
      />
      <AfastamentosCard f={f} afast={data.afast} onMudou={refetch} />
      <DesligamentoCard f={f} hoje={hoje} onMudou={refetch} />

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Documento com dados pessoais, de uso restrito ao empregador para cumprir obrigações
        trabalhistas e legais (LGPD, Lei 13.709/2018, art. 7º, II). Não contém dados de saúde
        (diagnóstico/CID). Emitido em{" "}
        {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} pelo PontoFlex.
      </p>
    </div>
  );
}

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function DadosContrato({ f, hoje }: { f: Func; hoje: string }) {
  const fases = fasesExperiencia(f);
  const termino = terminoPrevisto(f);
  const tempo = f.data_admissao ? diasEntre(f.data_admissao, f.data_desligamento ?? hoje) : null;
  const anos = tempo != null ? Math.floor(tempo / 365.25) : 0;
  const meses = tempo != null ? Math.floor((tempo % 365.25) / 30.44) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Dados e contrato</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-8 md:grid-cols-2">
        <div>
          <Linha k="CPF" v={<span className="font-mono">{f.cpf}</span>} />
          <Linha k="Matrícula" v={f.matricula} />
          <Linha k="Cargo / função" v={f.cargo || "—"} />
          <Linha k="Telefone" v={f.telefone || "—"} />
          <Linha
            k="Jornada"
            v={`${ESCALAS[f.escala]?.label ?? f.escala} · ${f.hora_entrada.slice(0, 5)}–${f.hora_saida_almoco.slice(0, 5)} / ${f.hora_retorno_almoco.slice(0, 5)}–${f.hora_saida.slice(0, 5)}`}
          />
        </div>
        <div>
          <Linha
            k="Admissão"
            v={
              f.data_admissao ? (
                br(f.data_admissao)
              ) : (
                <span className="text-destructive">não informada</span>
              )
            }
          />
          <Linha
            k="Contrato"
            v={TIPOS_CONTRATO[f.tipo_contrato as TipoContrato] ?? f.tipo_contrato}
          />
          {fases && (
            <Linha
              k="Experiência"
              v={`${f.experiencia_dias} dias até ${br(fases.fim1)}${fases.fim2 ? ` + ${f.experiencia_prorrogacao_dias} até ${br(fases.fim2)}` : ""}`}
            />
          )}
          {termino && !fases && <Linha k="Término previsto" v={br(termino)} />}
          {tempo != null && <Linha k="Tempo de empresa" v={`${anos} ano(s) e ${meses} mês(es)`} />}
          {f.data_desligamento && <Linha k="Desligamento" v={br(f.data_desligamento)} />}
        </div>
        <p className="pt-2 text-xs text-muted-foreground print:hidden md:col-span-2">
          Para alterar estes dados, use o lápis na lista de Funcionários.
        </p>
      </CardContent>
    </Card>
  );
}

function FeriasCard({
  f,
  periodos,
  ferias,
  hoje,
  onMudou,
  faltasProntas,
}: {
  f: Func;
  periodos: PeriodoAquisitivo[];
  ferias: Ferias[];
  hoje: string;
  onMudou: () => void;
  faltasProntas: boolean;
}) {
  const qc = useQueryClient();
  const cfg = f as EscalaCfg;
  const sugestao = useMemo(() => sugerirFerias(periodos, cfg, hoje), [periodos, cfg, hoje]);
  const [periodoIni, setPeriodoIni] = useState("");
  const [inicio, setInicio] = useState("");
  const [dias, setDias] = useState("");
  const [abono, setAbono] = useState("0");
  const [busy, setBusy] = useState(false);

  const periodo = periodos.find((p) => p.inicio === periodoIni);
  const nova =
    periodo && inicio && Number(dias)
      ? {
          aquisitivo_inicio: periodo.inicio,
          inicio,
          dias: Number(dias),
          abono_dias: Number(abono) || 0,
        }
      : null;
  const checagem =
    nova && periodo ? validarFerias({ nova, periodo, outras: ferias, cfg, hoje }) : null;

  if (!f.data_admissao)
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarHeart className="size-5" /> Férias
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Informe a data de admissão no cadastro para o PontoFlex calcular as férias.
        </CardContent>
      </Card>
    );

  async function salvar() {
    if (!nova || !checagem || checagem.erros.length) return;
    setBusy(true);
    try {
      const { data: emp } = await supabase.from("empresas").select("id").maybeSingle();
      const { error } = await supabase.from("ferias").insert({
        empresa_id: emp!.id,
        funcionario_id: f.id,
        aquisitivo_inicio: periodo!.inicio,
        aquisitivo_fim: periodo!.fim,
        inicio: nova.inicio,
        dias: nova.dias,
        abono_dias: nova.abono_dias,
      });
      if (error) throw new Error("Não foi possível salvar as férias");
      toast.success("Férias programadas");
      setInicio("");
      setDias("");
      setAbono("0");
      onMudou();
      qc.invalidateQueries({ queryKey: ["avisos-rh"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function remover(x: Ferias) {
    if (!confirm(`Cancelar as férias de ${br(x.inicio)} (${x.dias} dias)?`)) return;
    const { error } = await supabase.from("ferias").delete().eq("id", x.id);
    if (error) toast.error("Não foi possível cancelar");
    else {
      toast.success("Férias canceladas");
      onMudou();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarHeart className="size-5" /> Férias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1">Período aquisitivo</th>
                <th>Direito</th>
                <th>Usados</th>
                <th>Saldo</th>
                <th>Conceder até</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {[...periodos].reverse().map((p) => (
                <tr key={p.inicio} className="border-t">
                  <td className="whitespace-nowrap py-1.5">
                    {br(p.inicio)} a {br(p.fim)}
                  </td>
                  <td>{p.direito}</td>
                  <td>{p.usados}</td>
                  <td className="font-semibold">{p.saldo}</td>
                  <td className="whitespace-nowrap">{br(p.limiteConcessao)}</td>
                  <td>
                    <Badge
                      variant={
                        p.situacao === "vencido"
                          ? "destructive"
                          : p.situacao === "quitado"
                            ? "default"
                            : p.situacao === "vencendo"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {SITUACAO_LABEL[p.situacao]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted-foreground">
            Direito pela CLT art. 130: 30 dias com até 5 faltas injustificadas no período (6–14: 24;
            15–23: 18; 24–32: 12; mais de 32: nenhum). Faltas contadas a partir do início do uso do
            PontoFlex{faltasProntas ? "" : " (calculando…)"}.
          </p>
        </div>

        {ferias.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold">Programadas / gozadas</p>
            {ferias.map((x) => (
              <div key={x.id} className="flex items-center justify-between border-t py-1.5 text-sm">
                <span>
                  {br(x.inicio)} a {br(somarDias(x.inicio, x.dias - 1))} · {x.dias} dias
                  {x.abono_dias ? ` + ${x.abono_dias} vendidos` : ""}
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    (período {br(x.aquisitivo_inicio)})
                  </span>
                </span>
                {x.inicio > hoje && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="print:hidden"
                    aria-label="Cancelar férias"
                    onClick={() => remover(x)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!f.data_desligamento && (
          <div className="space-y-3 rounded-lg border p-3 print:hidden">
            {sugestao && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 p-3 text-sm">
                <p className="flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <strong>Sugestão:</strong> {sugestao.dias} dias de {br(sugestao.inicio)} a{" "}
                    {br(sugestao.fim)}. Avise o funcionário até {br(sugestao.avisarAte)}.
                    {sugestao.urgente && (
                      <span className="font-semibold text-destructive">
                        {" "}
                        Atenção: passa do prazo de concessão ({br(sugestao.periodo.limiteConcessao)}
                        ).
                      </span>
                    )}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPeriodoIni(sugestao.periodo.inicio);
                    setInicio(sugestao.inicio);
                    setDias(String(sugestao.dias));
                    setAbono("0");
                  }}
                >
                  Usar sugestão
                </Button>
              </div>
            )}
            <p className="text-sm font-semibold">Programar férias</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Período aquisitivo</Label>
                <Select value={periodoIni} onValueChange={setPeriodoIni}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodos
                      .filter((p) => p.saldo > 0)
                      .map((p) => (
                        <SelectItem key={p.inicio} value={p.inicio}>
                          {br(p.inicio)} a {br(p.fim)} · saldo {p.saldo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Início</Label>
                <CampoData value={inicio} onChange={setInicio} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Dias</Label>
                  <Input
                    inputMode="numeric"
                    value={dias}
                    onChange={(e) => setDias(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  />
                </div>
                <div className="space-y-1">
                  <Label title="Abono pecuniário: dias vendidos">Vendidos</Label>
                  <Input
                    inputMode="numeric"
                    value={abono}
                    onChange={(e) => setAbono(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  />
                </div>
              </div>
            </div>
            {checagem?.erros.map((e) => (
              <p key={e} className="text-sm text-destructive">
                • {e}
              </p>
            ))}
            {checagem?.avisos.map((e) => (
              <p key={e} className="text-sm text-amber-700 dark:text-amber-400">
                • {e}
              </p>
            ))}
            <Button onClick={salvar} disabled={busy || !checagem || checagem.erros.length > 0}>
              Salvar férias
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AfastamentosCard({ f, afast, onMudou }: { f: Func; afast: Afast[]; onMudou: () => void }) {
  const [tipo, setTipo] = useState<TipoAfastamento>("atestado");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  function escolherInicio(v: string) {
    setInicio(v);
    const padrao = DIAS_PADRAO_AFASTAMENTO[tipo];
    if (v && padrao && !fim) setFim(somarDias(v, padrao - 1));
  }

  async function salvar() {
    if (!inicio || !fim) {
      toast.error("Informe o início e o término");
      return;
    }
    if (fim < inicio) {
      toast.error("O término não pode ser antes do início");
      return;
    }
    if (f.data_admissao && inicio < f.data_admissao) {
      toast.error("O afastamento não pode começar antes da admissão");
      return;
    }
    setBusy(true);
    try {
      const { data: emp } = await supabase.from("empresas").select("id").maybeSingle();
      const { error } = await supabase.from("afastamentos").insert({
        empresa_id: emp!.id,
        funcionario_id: f.id,
        tipo,
        inicio,
        fim,
        observacao: obs.trim() || null,
      });
      if (error) throw new Error("Não foi possível salvar o afastamento");
      toast.success("Afastamento registrado");
      setInicio("");
      setFim("");
      setObs("");
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function remover(a: Afast) {
    if (!confirm(`Excluir o afastamento de ${br(a.inicio)} a ${br(a.fim)}?`)) return;
    const { error } = await supabase.from("afastamentos").delete().eq("id", a.id);
    if (error) toast.error("Não foi possível excluir");
    else onMudou();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="size-5" /> Afastamentos e licenças
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {afast.length === 0 && <p className="text-sm text-muted-foreground">Nenhum afastamento.</p>}
        {afast.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between border-t py-1.5 text-sm first:border-0"
          >
            <span>
              <strong>{TIPOS_AFASTAMENTO[a.tipo as TipoAfastamento] ?? a.tipo}</strong> ·{" "}
              {br(a.inicio)} a {br(a.fim)} ({diasEntre(a.inicio, a.fim) + 1} dias)
              {a.observacao && <span className="text-muted-foreground"> · {a.observacao}</span>}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="print:hidden"
              aria-label="Excluir afastamento"
              onClick={() => remover(a)}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        {!f.data_desligamento && (
          <div className="space-y-3 rounded-lg border p-3 print:hidden">
            <p className="text-sm font-semibold">Registrar afastamento</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={tipo}
                  onValueChange={(v) => {
                    setTipo(v as TipoAfastamento);
                    setFim("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS_AFASTAMENTO).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Início</Label>
                <CampoData value={inicio} onChange={escolherInicio} />
              </div>
              <div className="space-y-1">
                <Label>Término</Label>
                <CampoData value={fim} onChange={setFim} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Input
                maxLength={300}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ex.: atestado entregue ao RH em 10/11"
              />
              <p className="text-xs text-muted-foreground">
                Não escreva diagnóstico nem CID: são dados de saúde protegidos pela LGPD. Guarde o
                atestado original com o RH.
              </p>
            </div>
            <Button onClick={salvar} disabled={busy}>
              Registrar
            </Button>
            <p className="text-xs text-muted-foreground">
              Os dias de afastamento aparecem no espelho de ponto como justificados, não como falta.
              Suspensão e licença não remunerada contam como faltas para as férias.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DesligamentoCard({ f, hoje, onMudou }: { f: Func; hoje: string; onMudou: () => void }) {
  const desligar = useServerFn(desligarFuncionario);
  const desfazer = useServerFn(desfazerDesligamento);
  const [dataD, setDataD] = useState(hoje);
  const [motivo, setMotivo] = useState<MotivoDesligamento | "">("");
  const [aviso, setAviso] = useState<AvisoPrevio | "">("");
  const [obs, setObs] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);

  if (f.data_desligamento)
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserX className="size-5" /> Desligamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Linha k="Data" v={br(f.data_desligamento)} />
          <Linha
            k="Motivo"
            v={MOTIVOS_DESLIGAMENTO[f.motivo_desligamento as MotivoDesligamento] ?? "—"}
          />
          <Linha k="Aviso prévio" v={AVISOS_PREVIOS[f.aviso_previo as AvisoPrevio] ?? "—"} />
          {f.desligamento_obs && <Linha k="Observação" v={f.desligamento_obs} />}
          <p className="pt-2 text-xs text-muted-foreground">
            Acesso bloqueado e biometria facial apagada. As marcações e folhas ficam guardadas pelo
            prazo legal.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 print:hidden"
            onClick={async () => {
              if (!confirm("Desfazer o desligamento? O funcionário volta a ficar ativo.")) return;
              try {
                await desfazer({ data: { id: f.id } });
                toast.success(
                  "Desligamento desfeito. Cadastre o rosto de novo para usar o terminal.",
                );
                onMudou();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro");
              }
            }}
          >
            Desfazer (lançado por engano)
          </Button>
        </CardContent>
      </Card>
    );

  const avisoProporcional =
    f.data_admissao && dataD && motivo === "sem_justa_causa"
      ? diasAvisoPrevio(f.data_admissao, dataD)
      : null;

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserX className="size-5" /> Desligamento / término de contrato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Último dia de trabalho</Label>
            <CampoData value={dataD} onChange={setDataD} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoDesligamento)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOTIVOS_DESLIGAMENTO).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Aviso prévio</Label>
            <Select value={aviso} onValueChange={(v) => setAviso(v as AvisoPrevio)}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AVISOS_PREVIOS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {avisoProporcional && (
          <p className="text-xs text-muted-foreground">
            Aviso prévio proporcional: {avisoProporcional} dias (Lei 12.506/2011: 30 + 3 por ano
            completo).
          </p>
        )}
        <div className="space-y-1">
          <Label>Observação (opcional)</Label>
          <Textarea maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <Button
          variant="destructive"
          disabled={!dataD || !motivo || !aviso}
          onClick={() => setConfirmar(true)}
        >
          Registrar desligamento
        </Button>
        <p className="text-xs text-muted-foreground">
          O PontoFlex registra o desligamento, bloqueia o acesso e apaga a biometria. Rescisão, TRCT
          e eSocial continuam com a contabilidade.
        </p>
      </CardContent>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desligar {f.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Último dia: {br(dataD)}. O acesso ao app e ao terminal será bloqueado e a foto do
              rosto apagada. Marcações e folhas continuam guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await desligar({
                    data: {
                      id: f.id,
                      data: dataD,
                      motivo: motivo as string,
                      aviso: aviso as string,
                      obs,
                    },
                  });
                  toast.success("Desligamento registrado");
                  onMudou();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar desligamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
