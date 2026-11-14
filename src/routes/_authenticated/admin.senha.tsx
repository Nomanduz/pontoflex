import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pedirCodigoSenhaEmpresa, trocarSenhaEmpresa } from "@/lib/empresa-senha.functions";

export const Route = createFileRoute("/_authenticated/admin/senha")({
  head: () => ({
    meta: [
      { title: "Senha da empresa — PontoFlex" },
      { name: "description", content: "Troque a senha da empresa com confirmação por e-mail." },
      { property: "og:title", content: "Senha da empresa — PontoFlex" },
      {
        property: "og:description",
        content: "Troque a senha da empresa com confirmação por e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SenhaEmpresa,
});

function SenhaEmpresa() {
  const pedir = useServerFn(pedirCodigoSenhaEmpresa);
  const trocar = useServerFn(trocarSenhaEmpresa);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);

  async function enviarCodigo() {
    setBusy(true);
    try {
      const r = await pedir();
      setEnviadoPara(r.email);
      toast.success(`Código enviado para ${r.email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar o código");
    } finally {
      setBusy(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== conf) return void toast.error("A confirmação não confere com a nova senha");
    setBusy(true);
    try {
      await trocar({ data: { atual, nova, codigo } });
      toast.success("Senha da empresa trocada!");
      setEnviadoPara(null);
      setCodigo("");
      setAtual("");
      setNova("");
      setConf("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao trocar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Senha da empresa</h1>
      <p className="text-sm text-muted-foreground">
        Para sua segurança, enviamos um código ao e-mail cadastrado da empresa antes de trocar a
        senha.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {enviadoPara ? "Confirme a troca" : "1. Receber código"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!enviadoPara ? (
            <Button className="w-full" onClick={enviarCodigo} disabled={busy}>
              {busy ? "Enviando…" : "Enviar código por e-mail"}
            </Button>
          ) : (
            <form onSubmit={salvar} className="space-y-3">
              <p className="text-sm">
                Enviamos um código para <strong>{enviadoPara}</strong>. Ele vale por 15 minutos.
              </p>
              <div className="space-y-1">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="atual">Senha atual</Label>
                <Input
                  id="atual"
                  type="password"
                  value={atual}
                  onChange={(e) => setAtual(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nova">Nova senha</Label>
                <Input
                  id="nova"
                  type="password"
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="conf">Confirmar nova senha</Label>
                <Input
                  id="conf"
                  type="password"
                  value={conf}
                  onChange={(e) => setConf(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Salvando…" : "Trocar senha"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={enviarCodigo}
                disabled={busy}
              >
                Reenviar código
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
