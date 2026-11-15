import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, KeyRound, ScanFace, Check, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoData, CampoHora } from "@/components/CampoDataHora";
import { FiltroDepartamento, useDepartamentos } from "@/components/FiltroDepartamento";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  alterarAtivoFuncionario,
  createFuncionario,
  deleteFuncionario,
  resetSenhaFuncionario,
} from "@/lib/funcionarios.functions";
import { maskCpf } from "@/lib/doc";
import { analisarRosto, redefinirRosto } from "@/lib/ponto.functions";
import { DIAS_SEMANA, ESCALAS, isCiclo } from "@/lib/escala";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";
import { dayKey, formatKey } from "@/lib/ponto";
import { alertasContrato, terminoPrevisto, TIPOS_CONTRATO, validarContrato } from "@/lib/vinculo";

type Func = Database["public"]["Tables"]["funcionarios"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/funcionarios")({
  head: () => ({
    meta: [
      { title: "Funcionários — PontoFlex" },
      { name: "description", content: "Cadastro de funcionários da empresa." },
      { property: "og:title", content: "Funcionários — PontoFlex" },
      { property: "og:description", content: "Cadastro de funcionários da empresa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Funcionarios,
});

const vazio = {
  nome: "",
  cpf: "",
  telefone: "",
  cargo: "",
  departamento: "",
  matricula: "",
  escala: "5x2",
  dias_semana: [1, 2, 3, 4, 5] as number[],
  escala_inicio: "",
  hora_entrada: "08:00",
  hora_saida_almoco: "12:00",
  hora_retorno_almoco: "13:00",
  hora_saida: "17:00",
  data_admissao: "",
  tipo_contrato: "experiencia",
  experiencia_dias: "45",
  experiencia_prorrogacao_dias: "45",
  contrato_fim: "",
};
const contratoCampos = (f: typeof vazio) => {
  const exp = f.tipo_contrato === "experiencia";
  const comFim = ["determinado", "estagio", "aprendiz"].includes(f.tipo_contrato);
  return {
    data_admissao: f.data_admissao || null,
    tipo_contrato: f.tipo_contrato,
    experiencia_dias: exp ? Number(f.experiencia_dias) || null : null,
    experiencia_prorrogacao_dias: exp ? Number(f.experiencia_prorrogacao_dias) || null : null,
    contrato_fim: comFim ? f.contrato_fim || null : null,
  };
};
const escalaCampos = (f: typeof vazio) => ({
  escala: f.escala,
  dias_semana: f.escala === "personalizada" ? f.dias_semana : null,
  escala_inicio: isCiclo(f.escala) ? f.escala_inicio || null : null,
  hora_entrada: f.hora_entrada,
  hora_saida_almoco: f.hora_saida_almoco,
  hora_retorno_almoco: f.hora_retorno_almoco,
  hora_saida: f.hora_saida,
});

function Funcionarios() {
  const qc = useQueryClient();
  const criar = useServerFn(createFuncionario);
  const excluir = useServerFn(deleteFuncionario);
  const resetar = useServerFn(resetSenhaFuncionario);
  const resetRosto = useServerFn(redefinirRosto);
  const analisar = useServerFn(analisarRosto);
  const alterarAtivo = useServerFn(alterarAtivoFuncionario);
  const [foto, setFoto] = useState<{ f: Func; url: string | null } | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const { data: empresa } = useQuery({
    queryKey: ["minha-empresa"],
    queryFn: async () =>
      (await supabase.from("empresas").select("documento, tipo_documento").maybeSingle()).data,
  });
  const [form, setForm] = useState<typeof vazio & { id?: string }>(vazio);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Func | null>(null);
  const [senhaFor, setSenhaFor] = useState<Func | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{
    nome: string;
    matricula: string | null;
    senha: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: funcs } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => (await supabase.from("funcionarios").select("*").order("nome")).data ?? [],
  });
  const refresh = () => qc.invalidateQueries();
  const { data: departamentos } = useDepartamentos();
  const [filtroDepto, setFiltroDepto] = useState("todos");
  const [verDesligados, setVerDesligados] = useState(false);
  const lista = (funcs ?? []).filter(
    (f) =>
      (filtroDepto === "todos" || f.departamento === filtroDepto) &&
      (verDesligados || !f.data_desligamento),
  );
  const desligados = (funcs ?? []).filter((f) => f.data_desligamento).length;

  async function salvar() {
    setSaving(true);
    try {
      if (isCiclo(form.escala) && !form.escala_inicio)
        throw new Error("Informe o primeiro dia de trabalho da escala");
      if (form.escala === "personalizada" && form.dias_semana.length === 0)
        throw new Error("Escolha os dias de trabalho");
      if (!form.matricula.trim())
        throw new Error("Informe a matrícula (o funcionário usa para entrar)");
      const erroContrato = validarContrato(contratoCampos(form));
      if (erroContrato) throw new Error(erroContrato);
      let id = form.id;
      let senha: string | undefined;
      if (!id) {
        const r = await criar({ data: form });
        id = r.id;
        senha = r.senha;
      }
      const { error } = await supabase
        .from("funcionarios")
        .update({
          nome: form.nome.trim(),
          telefone: form.telefone || null,
          cargo: form.cargo || null,
          departamento: form.departamento.trim() || null,
          matricula: form.matricula.trim(),
          ...escalaCampos(form),
          ...contratoCampos(form),
        })
        .eq("id", id!);
      if (error)
        throw new Error(
          error.code === "23505"
            ? "Esta matrícula já está em uso na empresa"
            : "Não foi possível salvar",
        );
      toast.success("Funcionário salvo");
      setOpen(false);
      if (senha)
        setSenhaGerada({ nome: form.nome.trim(), matricula: form.matricula || null, senha });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(f: Func) {
    try {
      await alterarAtivo({ data: { id: f.id, ativo: !f.ativo } });
      toast.success(
        f.ativo ? "Funcionário desativado (histórico mantido)" : "Funcionário reativado",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o status");
    }
    refresh();
  }

  async function abrirFoto(f: Func) {
    setFoto({ f, url: null });
    if (!f.foto_path) return;
    const { data } = await supabase.storage.from("faces").createSignedUrl(f.foto_path, 120);
    setFoto({ f, url: data?.signedUrl ?? null });
  }

  async function decidirFoto(aprovar: boolean) {
    if (!foto) return;
    setAnalisando(true);
    try {
      await analisar({ data: { id: foto.f.id, aprovar } });
      toast.success(
        aprovar
          ? "Rosto aprovado: o funcionário já pode bater o ponto"
          : "Foto recusada: o funcionário enviará outra",
      );
      setFoto(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao analisar");
      refresh();
    } finally {
      setAnalisando(false);
    }
  }

  const ROSTO: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    sem_foto: { label: "Sem rosto", variant: "outline" },
    pendente: { label: "Aprovar foto", variant: "secondary" },
    aprovada: { label: "Aprovado", variant: "default" },
    recusada: { label: "Recusado", variant: "destructive" },
  };

  const hm = (t: string) => t.slice(0, 5);
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: k === "cpf" ? maskCpf(e.target.value) : e.target.value });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Funcionários</h1>
        <Button
          onClick={() => {
            setForm(vazio);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Novo
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <FiltroDepartamento valor={filtroDepto} onChange={setFiltroDepto} />
        {desligados > 0 && (
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Switch checked={verDesligados} onCheckedChange={setVerDesligados} />
            Mostrar desligados ({desligados})
          </label>
        )}
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Nome</th>
                <th>CPF</th>
                <th className="hidden md:table-cell">Cargo / depto.</th>
                <th className="hidden md:table-cell">Matrícula</th>
                <th>Rosto</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="py-2">
                    <Link
                      to="/admin/funcionario/$id"
                      params={{ id: f.id }}
                      className="font-medium hover:underline"
                    >
                      {f.nome}
                    </Link>
                    {f.data_desligamento ? (
                      <p className="text-xs text-muted-foreground">
                        Desligado em{" "}
                        {formatKey(f.data_desligamento, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    ) : (
                      alertasContrato(f, dayKey(new Date())).map((a) => (
                        <p
                          key={a.texto}
                          className={`text-xs ${a.nivel === "urgente" ? "font-semibold text-destructive" : "text-amber-700 dark:text-amber-400"}`}
                        >
                          {a.texto}
                        </p>
                      ))
                    )}
                    {!f.data_admissao && !f.data_desligamento && (
                      <p className="text-xs text-muted-foreground">Falta a data de admissão</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{f.cpf}</td>
                  <td className="hidden md:table-cell">
                    {f.cargo}
                    {f.departamento && (
                      <span className="block text-xs text-muted-foreground">{f.departamento}</span>
                    )}
                  </td>
                  <td className="hidden md:table-cell">{f.matricula}</td>
                  <td>
                    {f.foto_status === "pendente" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7"
                        onClick={() => abrirFoto(f)}
                      >
                        Aprovar foto
                      </Button>
                    ) : (
                      <Badge
                        variant={ROSTO[f.foto_status]?.variant ?? "outline"}
                        className="cursor-default"
                      >
                        {ROSTO[f.foto_status]?.label ?? f.foto_status}
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={f.ativo}
                        onCheckedChange={() => toggle(f)}
                        aria-label="Ativo"
                      />
                      <Badge
                        variant={f.ativo ? "default" : "secondary"}
                        className="hidden sm:inline-flex"
                      >
                        {f.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" asChild>
                      <Link
                        to="/admin/funcionario/$id"
                        params={{ id: f.id }}
                        aria-label="Ficha, férias e afastamentos"
                        title="Ficha, férias e afastamentos"
                      >
                        <FileText className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar"
                      onClick={() => {
                        setForm({
                          ...vazio,
                          id: f.id,
                          nome: f.nome,
                          cpf: f.cpf,
                          telefone: f.telefone ?? "",
                          cargo: f.cargo ?? "",
                          departamento: f.departamento ?? "",
                          matricula: f.matricula ?? "",
                          escala: f.escala,
                          dias_semana: f.dias_semana ?? [],
                          escala_inicio: f.escala_inicio ?? "",
                          hora_entrada: hm(f.hora_entrada),
                          hora_saida_almoco: hm(f.hora_saida_almoco),
                          hora_retorno_almoco: hm(f.hora_retorno_almoco),
                          hora_saida: hm(f.hora_saida),
                          data_admissao: f.data_admissao ?? "",
                          tipo_contrato: f.tipo_contrato,
                          experiencia_dias: f.experiencia_dias ? String(f.experiencia_dias) : "",
                          experiencia_prorrogacao_dias: f.experiencia_prorrogacao_dias
                            ? String(f.experiencia_prorrogacao_dias)
                            : "",
                          contrato_fim: f.contrato_fim ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {f.foto_status !== "sem_foto" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Redefinir rosto"
                        title="Redefinir rosto"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Redefinir o rosto de ${f.nome}? A foto atual será apagada e será preciso cadastrar de novo.`,
                            )
                          )
                            return;
                          try {
                            await resetRosto({ data: { id: f.id } });
                            toast.success("Rosto redefinido");
                            refresh();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erro");
                          }
                        }}
                      >
                        <ScanFace className="size-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Gerar nova senha"
                      title="Gerar nova senha"
                      onClick={() => setSenhaFor(f)}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Excluir"
                      onClick={() => setDel(f)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={set("nome")} />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input
                value={form.cpf}
                onChange={set("cpf")}
                disabled={!!form.id}
                inputMode="numeric"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cargo</Label>
                <Input value={form.cargo} onChange={set("cargo")} />
              </div>
              <div className="space-y-1">
                <Label>Matrícula *</Label>
                <Input value={form.matricula} onChange={set("matricula")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Departamento / setor</Label>
                <Input
                  value={form.departamento}
                  onChange={set("departamento")}
                  list="lista-departamentos"
                  maxLength={80}
                  placeholder="Ex.: Produção"
                />
                <datalist id="lista-departamentos">
                  {departamentos?.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={set("telefone")} />
              </div>
            </div>
            <ContratoForm form={form} setForm={setForm} />
            <div className="space-y-1">
              <Label>Escala de trabalho</Label>
              <Select value={form.escala} onValueChange={(v) => setForm({ ...form, escala: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ESCALAS).map(([k, d]) => (
                    <SelectItem key={k} value={k}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.escala === "personalizada" && (
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d, i) => {
                  const on = form.dias_semana.includes(i);
                  return (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      onClick={() =>
                        setForm({
                          ...form,
                          dias_semana: on
                            ? form.dias_semana.filter((x) => x !== i)
                            : [...form.dias_semana, i].sort(),
                        })
                      }
                    >
                      {d}
                    </Button>
                  );
                })}
              </div>
            )}
            {isCiclo(form.escala) && (
              <div className="space-y-1">
                <Label>Primeiro dia de trabalho do ciclo</Label>
                <CampoData
                  value={form.escala_inicio}
                  onChange={(v) => setForm((f) => ({ ...f, escala_inicio: v }))}
                />
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["hora_entrada", "Entrada"],
                  ["hora_saida_almoco", "Saí. interv."],
                  ["hora_retorno_almoco", "Retorno"],
                  ["hora_saida", "Saída"],
                ] as const
              ).map(([k, l]) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs">{l}</Label>
                  <CampoHora
                    value={form[k]}
                    onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
                    className="px-1 text-center"
                    aria-label={l}
                  />
                </div>
              ))}
            </div>
            {!form.id && (
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                A senha de acesso do funcionário será gerada automaticamente e exibida uma única vez
                após o cadastro.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={salvar} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!senhaFor} onOpenChange={(o) => !o && setSenhaFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova senha para {senhaFor?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A senha atual deixará de funcionar. A nova senha será exibida uma única vez para você
              entregar ao funcionário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const r = await resetar({ data: { id: senhaFor!.id } });
                  setSenhaGerada({
                    nome: senhaFor!.nome,
                    matricula: senhaFor!.matricula,
                    senha: r.senha,
                  });
                  setSenhaFor(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro");
                }
              }}
            >
              Gerar senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!senhaGerada} onOpenChange={(o) => !o && setSenhaGerada(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso de {senhaGerada?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Anote e entregue ao funcionário. Esta senha não será exibida novamente.
          </p>
          <div className="space-y-2 rounded-xl bg-muted p-4 text-sm">
            <p>
              CPF/CNPJ da empresa:{" "}
              <span className="font-mono font-bold">{empresa?.documento ?? "—"}</span>
            </p>
            <p>
              Matrícula:{" "}
              <span className="font-mono font-bold">{senhaGerada?.matricula ?? "—"}</span>
            </p>
            <p>
              Senha:{" "}
              <span className="font-mono text-lg font-bold tracking-wider">
                {senhaGerada?.senha}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSenhaGerada(null)}>Entendi, já anotei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!foto} onOpenChange={(o) => !o && !analisando && setFoto(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Foto de {foto?.f.nome}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg bg-muted">
            {foto?.url ? (
              <img
                src={foto.url}
                alt={`Foto de referência de ${foto.f.nome}`}
                className="aspect-[3/4] w-full -scale-x-100 object-cover"
              />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Carregando foto…</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Confira se é mesmo o funcionário, com o rosto nítido e sem outra pessoa na foto. Ao
            aprovar, o rosto passa a ser reconhecido no terminal e no app.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => decidirFoto(false)} disabled={analisando}>
              <X className="size-4" /> Recusar
            </Button>
            <Button onClick={() => decidirFoto(true)} disabled={analisando}>
              <Check className="size-4" /> {analisando ? "Aprovando…" : "Aprovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {del?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Use apenas para cadastro feito por engano. Funcionário que já registrou ponto não pode
              ser excluído (a lei exige guardar o histórico): nesse caso, desative.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await excluir({ data: { id: del!.id } });
                  toast.success("Funcionário excluído");
                  refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type FormFunc = typeof vazio & { id?: string };

function ContratoForm({
  form,
  setForm,
}: {
  form: FormFunc;
  setForm: React.Dispatch<React.SetStateAction<FormFunc>>;
}) {
  const termino = terminoPrevisto(contratoCampos(form));
  const fmt = (k: string) => formatKey(k, { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">Contrato de trabalho</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Admissão *</Label>
          <CampoData
            value={form.data_admissao}
            onChange={(v) => setForm((f) => ({ ...f, data_admissao: v }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select
            value={form.tipo_contrato}
            onValueChange={(v) => setForm((f) => ({ ...f, tipo_contrato: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_CONTRATO).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {form.tipo_contrato === "experiencia" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>1º período (dias)</Label>
            <Input
              inputMode="numeric"
              value={form.experiencia_dias}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  experiencia_dias: e.target.value.replace(/\D/g, "").slice(0, 2),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label>Prorrogação (dias)</Label>
            <Input
              inputMode="numeric"
              placeholder="opcional"
              value={form.experiencia_prorrogacao_dias}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  experiencia_prorrogacao_dias: e.target.value.replace(/\D/g, "").slice(0, 2),
                }))
              }
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            Máximo de 90 dias somando os dois períodos, com uma única prorrogação (CLT arts. 445 e
            451). Comum: 45 + 45 ou 30 + 60.
          </p>
        </div>
      )}
      {["determinado", "estagio", "aprendiz"].includes(form.tipo_contrato) && (
        <div className="space-y-1">
          <Label>Término previsto</Label>
          <CampoData
            value={form.contrato_fim}
            onChange={(v) => setForm((f) => ({ ...f, contrato_fim: v }))}
          />
        </div>
      )}
      {termino && (
        <p className="rounded bg-muted p-2 text-xs">
          Contrato termina em <strong>{fmt(termino)}</strong>. O PontoFlex avisa 15 dias antes.
        </p>
      )}
    </fieldset>
  );
}
