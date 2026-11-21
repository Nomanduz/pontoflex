import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { VoltarInicio } from "@/components/VoltarInicio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { consultarRedefinicao, redefinirSenhaEmpresa } from "@/lib/redefinir.functions";

export const Route = createFileRoute("/redefinir")({
  validateSearch: (s: Record<string, unknown>) => ({
    codigo: typeof s["codigo"] === "string" ? s["codigo"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Redefinir senha — PontoFlex" }, { name: "robots", content: "noindex" }],
  }),
  component: RedefinirPage,
});

type Dados = Awaited<ReturnType<typeof consultarRedefinicao>>;

const formatarCodigo = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, "$1-");

function RedefinirPage() {
  const { codigo: doLink } = Route.useSearch();
  const consultar = useServerFn(consultarRedefinicao);
  const redefinir = useServerFn(redefinirSenhaEmpresa);
  const [codigo, setCodigo] = useState(formatarCodigo(doLink ?? ""));
  const [dados, setDados] = useState<Dados | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState<string | null>(null);

  async function verificar(c = codigo) {
    setBusy(true);
    try {
      setDados(await consultar({ data: { codigo: c } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (doLink) verificar(doLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSalvar(e: FormEvent) {
    e.preventDefault();
    if (senha !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    setBusy(true);
    try {
      const r = await redefinir({ data: { codigo, senha } });
      setPronto(r.documento);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível trocar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-hero px-5 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-card p-6 shadow-xl">
        <VoltarInicio />
        <Brand className="text-primary" />
        {pronto ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" />
            <h1 className="font-display text-2xl font-bold">Senha alterada!</h1>
            <p className="text-muted-foreground">
              Entre na aba <strong>Empresa</strong> com o documento <strong>{pronto}</strong> e a
              nova senha.
            </p>
            <Button asChild>
              <Link to="/login">Ir para o login</Link>
            </Button>
          </div>
        ) : !dados ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verificar();
            }}
          >
            <div>
              <h1 className="font-display text-xl font-bold">Redefinir senha da empresa</h1>
              <p className="text-sm text-muted-foreground">
                Digite o código que você recebeu por e-mail ou da equipe PontoFlex.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                required
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX"
                value={codigo}
                onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
                className="h-11 font-mono tracking-widest"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Continuar
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onSalvar}>
            <div>
              <h1 className="font-display text-xl font-bold">Nova senha</h1>
              <p className="text-sm text-muted-foreground">
                {dados.razao_social} · {dados.tipo_documento} {dados.documento}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, com letras e números.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirma">Repita a nova senha</Label>
              <Input
                id="confirma"
                type="password"
                autoComplete="new-password"
                required
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} Salvar nova senha
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
