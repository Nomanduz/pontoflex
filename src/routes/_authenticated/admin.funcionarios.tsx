import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, KeyRound, ScanFace, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  matricula: "",
  escala: "5x2",
  dias_semana: [1, 2, 3, 4, 5] as number[],
  escala_inicio: "",
  hora_entrada: "08:00",
  hora_saida_almoco: "12:00",
  hora_retorno_almoco: "13:00",
  hora_saida: "17:00",
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

  async function salvar() {
    setSaving(true);
    try {
      if (isCiclo(form.escala) && !form.escala_inicio)
        throw new Error("Informe o primeiro dia de trabalho da escala");
      if (form.escala === "personalizada" && form.dias_semana.length === 0)
        throw new Error("Escolha os dias de trabalho");
      if (!form.matricula.trim())
        throw new Error("Informe a matrícula (o funcionário usa para entrar)");
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
          matricula: form.matricula.trim(),
          ...escalaCampos(form),
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
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Nome</th>
                <th>CPF</th>
                <th className="hidden md:table-cell">Cargo</th>
                <th className="hidden md:table-cell">Matrícula</th>
                <th>Rosto</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcs?.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="py-2 font-medium">{f.nome}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{f.cpf}</td>
                  <td className="hidden md:table-cell">{f.cargo}</td>
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
                          matricula: f.matricula ?? "",
                          escala: f.escala,
                          dias_semana: f.dias_semana ?? [],
                          escala_inicio: f.escala_inicio ?? "",
                          hora_entrada: hm(f.hora_entrada),
                          hora_saida_almoco: hm(f.hora_saida_almoco),
                          hora_retorno_almoco: hm(f.hora_retorno_almoco),
                          hora_saida: hm(f.hora_saida),
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
          {funcs?.length === 0 && (
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
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={set("telefone")} />
            </div>
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
                <Input type="date" value={form.escala_inicio} onChange={set("escala_inicio")} />
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
                  <Input type="time" value={form[k]} onChange={set(k)} className="px-1" />
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
