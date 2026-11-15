import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, Copy, Inbox, KeyRound, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatTime } from "@/lib/ponto";
import {
  alterarStatusEmpresa,
  aprovarSolicitacao,
  excluirEmpresa,
  gerarLinkRedefinicao,
  listarEmpresas,
  listarSolicitacoesCadastro,
  recusarSolicitacao,
} from "@/lib/nomanduz.functions";

export const Route = createFileRoute("/_authenticated/nomanduz")({
  beforeLoad: ({ context }) => {
    if (context.papel !== "superadmin") throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [{ title: "Painel Nomanduz — PontoFlex" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AppShell links={[{ to: "/nomanduz", label: "Painel Nomanduz" }]}>
      <Painel />
    </AppShell>
  ),
});

const STATUS_SOL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovada: { label: "Código enviado", variant: "outline" },
  ativada: { label: "Ativada", variant: "default" },
  recusada: { label: "Recusada", variant: "destructive" },
};

const quando = (t: string) => `${formatDate(t)} ${formatTime(t)}`;

function Painel() {
  const qc = useQueryClient();
  const listarSol = useServerFn(listarSolicitacoesCadastro);
  const listarEmp = useServerFn(listarEmpresas);
  const aprovar = useServerFn(aprovarSolicitacao);
  const recusar = useServerFn(recusarSolicitacao);
  const status = useServerFn(alterarStatusEmpresa);
  const excluir = useServerFn(excluirEmpresa);
  const linkSenha = useServerFn(gerarLinkRedefinicao);
  const [codigo, setCodigo] = useState<{
    titulo?: string;
    empresa: string;
    codigo: string;
    link: string;
    emailEnviado: boolean;
  } | null>(null);
  const [recusa, setRecusa] = useState<{ id: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [exclusao, setExclusao] = useState<{ id: string; nome: string; documento: string } | null>(
    null,
  );
  const [confirmacao, setConfirmacao] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: sols } = useQuery({
    queryKey: ["nomanduz-sol"],
    queryFn: () => listarSol({}),
    refetchInterval: 60_000,
  });
  const { data: emps } = useQuery({ queryKey: ["nomanduz-emp"], queryFn: () => listarEmp({}) });
  const recarregar = () =>
    qc
      .invalidateQueries({ queryKey: ["nomanduz-sol"] })
      .then(() => qc.invalidateQueries({ queryKey: ["nomanduz-emp"] }));

  async function acao<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      await recarregar();
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const pendentes = sols?.solicitacoes.filter((s) => s.status === "pendente").length ?? 0;

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Painel Nomanduz</h1>
      <Tabs defaultValue="solicitacoes">
        <TabsList>
          <TabsTrigger value="solicitacoes" className="gap-2">
            <Inbox className="size-4" /> Solicitações {pendentes > 0 && <Badge>{pendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2">
            <Building2 className="size-4" /> Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes" className="space-y-3">
          {sols?.solicitacoes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
          )}
          {sols?.solicitacoes.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span>{s.razao_social}</span>
                  <Badge variant={STATUS_SOL[s.status]?.variant}>
                    {STATUS_SOL[s.status]?.label ?? s.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">{s.tipo_documento}:</span>{" "}
                  <span className="font-mono">{s.documento}</span> · {s.responsavel}
                </p>
                <p>
                  <span className="text-muted-foreground">Contato:</span> {s.email}
                  {s.telefone ? ` · ${s.telefone}` : ""}
                  {s.qtd_funcionarios != null ? ` · ${s.qtd_funcionarios} funcionários` : ""}
                </p>
                {s.mensagem && <p className="rounded bg-muted p-2">{s.mensagem}</p>}
                {s.observacao && <p className="text-muted-foreground">Obs.: {s.observacao}</p>}
                <p className="text-xs text-muted-foreground">
                  Recebida em {quando(s.created_at)}
                  {s.codigo_expira_em && s.status === "aprovada"
                    ? ` · código vale até ${quando(s.codigo_expira_em)}`
                    : ""}
                </p>
                {["pendente", "aprovada"].includes(s.status) && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={async () => {
                        const r = await acao(() => aprovar({ data: { id: s.id } }));
                        if (r) setCodigo({ empresa: s.razao_social, ...r });
                      }}
                    >
                      <Check className="size-4" />{" "}
                      {s.status === "pendente" ? "Aprovar e enviar código" : "Reenviar novo código"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setMotivo("");
                        setRecusa({ id: s.id, nome: s.razao_social });
                      }}
                    >
                      <X className="size-4" /> Recusar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="empresas">
          <Card>
            <CardContent className="overflow-x-auto pt-4">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Empresa</th>
                    <th>Documento</th>
                    <th>Funcionários</th>
                    <th>Teste até</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {emps?.empresas.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="py-2">
                        <p className="font-medium">{e.razao_social}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.responsavel ?? ""} {e.email ?? ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs">{e.documento}</td>
                      <td>{e.funcionarios_ativos}</td>
                      <td className="whitespace-nowrap">
                        {e.teste_ate ? formatDate(e.teste_ate) : "—"}
                      </td>
                      <td>
                        <Select
                          value={e.status}
                          onValueChange={(v) =>
                            acao(
                              () =>
                                status({
                                  data: { id: e.id, status: v as "teste" | "ativa" | "suspensa" },
                                }),
                              "Status atualizado",
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="teste">Teste</SelectItem>
                            <SelectItem value="ativa">Ativa</SelectItem>
                            <SelectItem value="suspensa">Suspensa</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Gerar link para redefinir a senha"
                          title="Redefinir senha da empresa"
                          disabled={busy}
                          onClick={async () => {
                            const r = await acao(() => linkSenha({ data: { id: e.id } }));
                            if (r)
                              setCodigo({
                                titulo: "Redefinir senha (link vale 24 h)",
                                empresa: e.razao_social,
                                ...r,
                              });
                          }}
                        >
                          <KeyRound className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Excluir empresa"
                          onClick={() => {
                            setConfirmacao("");
                            setExclusao({ id: e.id, nome: e.razao_social, documento: e.documento });
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {emps?.empresas.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">Nenhuma empresa ativa ainda.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!codigo} onOpenChange={(o) => !o && setCodigo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {codigo?.titulo ?? "Código de ativação"} — {codigo?.empresa}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            {codigo?.emailEnviado
              ? "O e-mail com o link foi enviado."
              : "O e-mail NÃO foi enviado (verifique a configuração de e-mail). Envie o link manualmente, por exemplo pelo WhatsApp:"}
          </p>
          <div className="space-y-2 rounded-lg bg-muted p-3">
            <p className="font-mono text-xl font-bold tracking-widest">{codigo?.codigo}</p>
            <p className="break-all text-xs">{codigo?.link}</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(codigo?.link ?? "");
                toast.success("Link copiado");
              }}
            >
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button onClick={() => setCodigo(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recusa} onOpenChange={(o) => !o && setRecusa(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar {recusa?.nome}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="motivo">Motivo (vai no e-mail para o solicitante)</Label>
            <Input
              id="motivo"
              value={motivo}
              maxLength={500}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                await acao(
                  () => recusar({ data: { id: recusa!.id, observacao: motivo } }),
                  "Solicitação recusada",
                );
                setRecusa(null);
              }}
            >
              Recusar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!exclusao} onOpenChange={(o) => !o && setExclusao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {exclusao?.nome}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Isto apaga <strong>definitivamente</strong> a empresa, os funcionários, as marcações, as
            folhas, as fotos e os acessos. Use para empresas de teste ou a pedido do cliente (LGPD).
          </p>
          <div className="space-y-1">
            <Label htmlFor="conf">
              Digite o documento <span className="font-mono">{exclusao?.documento}</span> para
              confirmar
            </Label>
            <Input id="conf" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={
                busy ||
                confirmacao.replace(/\D/g, "") !== (exclusao?.documento ?? "").replace(/\D/g, "")
              }
              onClick={async () => {
                await acao(
                  () => excluir({ data: { id: exclusao!.id, confirmacao } }),
                  "Empresa excluída",
                );
                setExclusao(null);
              }}
            >
              Excluir definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
