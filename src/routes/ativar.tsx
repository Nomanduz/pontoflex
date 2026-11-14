import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ativarConta, consultarAtivacao } from "@/lib/cadastro.functions";

export const Route = createFileRoute("/ativar")({
  validateSearch: (s: Record<string, unknown>) => ({
    codigo: typeof s["codigo"] === "string" ? s["codigo"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Ativar acesso — PontoFlex" }, { name: "robots", content: "noindex" }],
  }),
  component: AtivarPage,
});

type Dados = Awaited<ReturnType<typeof consultarAtivacao>>;

const formatarCodigo = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12)
    .replace(/(.{4})(?=.)/g, "$1-");

function AtivarPage() {
  const { codigo: doLink } = Route.useSearch();
  const consultar = useServerFn(consultarAtivacao);
  const ativar = useServerFn(ativarConta);
  const [codigo, setCodigo] = useState(formatarCodigo(doLink ?? ""));
  const [dados, setDados] = useState<Dados | null>(null);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [aceite, setAceite] = useState(false);
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

  async function onAtivar(e: FormEvent) {
    e.preventDefault();
    if (senha !== confirma) {
      toast.error("As senhas não conferem");
      return;
    }
    setBusy(true);
    try {
      const r = await ativar({ data: { codigo, senha, aceite } });
      setPronto(r.documento);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ativar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-hero px-5 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-card p-6 shadow-xl">
        <Brand className="text-primary" />
        {pronto ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" />
            <h1 className="font-display text-2xl font-bold">Acesso ativado!</h1>
            <p className="text-muted-foreground">
              Entre na aba <strong>Empresa</strong> com <span className="font-mono">{pronto}</span>{" "}
              e a senha que você acabou de criar.
            </p>
            <Button asChild size="lg">
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
              <h1 className="font-display text-2xl font-bold">Ativar acesso</h1>
              <p className="text-sm text-muted-foreground">
                Digite o código de ativação que você recebeu por e-mail.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="codigo">Código de ativação</Label>
              <Input
                id="codigo"
                required
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX"
                className="h-12 font-mono text-lg tracking-widest"
                value={codigo}
                onChange={(e) => setCodigo(formatarCodigo(e.target.value))}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full"
              disabled={busy || codigo.length < 14}
            >
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound className="size-4" />}{" "}
              Verificar código
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onAtivar}>
            <div>
              <h1 className="font-display text-2xl font-bold">Crie a senha da empresa</h1>
              <p className="text-sm text-muted-foreground">
                {dados.razao_social} · {dados.tipo_documento} {dados.documento}
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirma">Confirme a senha</Label>
              <Input
                id="confirma"
                type="password"
                required
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
            </div>
            <label
              htmlFor="aceite"
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <Checkbox
                id="aceite"
                checked={aceite}
                onCheckedChange={(v) => setAceite(v === true)}
                className="mt-0.5"
              />
              <span>
                Li e aceito os{" "}
                <Link to="/termos" target="_blank" className="underline">
                  termos de uso e a política de privacidade
                </Link>
                . Período de teste de {dados.diasTeste} dias.
              </span>
            </label>
            <Button type="submit" size="lg" className="h-12 w-full" disabled={busy || !aceite}>
              {busy && <Loader2 className="animate-spin" />} Ativar acesso
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
