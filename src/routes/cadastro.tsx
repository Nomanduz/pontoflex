import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { VoltarInicio } from "@/components/VoltarInicio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskDocumento } from "@/lib/doc";
import { solicitarCadastro } from "@/lib/cadastro.functions";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastre sua empresa — PontoFlex" },
      {
        name: "description",
        content:
          "Peça acesso ao PontoFlex: ponto eletrônico com reconhecimento facial. Aceita CPF ou CNPJ.",
      },
    ],
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const enviar = useServerFn(solicitarCadastro);
  const [form, setForm] = useState({
    documento: "",
    razao_social: "",
    responsavel: "",
    email: "",
    telefone: "",
    qtd_funcionarios: "",
    mensagem: "",
    site: "",
  });
  const [busy, setBusy] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: k === "documento" ? maskDocumento(e.target.value) : e.target.value });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await enviar({
        data: {
          ...form,
          qtd_funcionarios: form.qtd_funcionarios ? Number(form.qtd_funcionarios) : null,
        },
      });
      setEnviado(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-hero px-5 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl bg-card p-6 shadow-xl">
        <VoltarInicio />
        <Brand className="text-primary" />
        {enviado ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto size-14 text-primary" />
            <h1 className="font-display text-2xl font-bold">Pedido enviado!</h1>
            <p className="text-muted-foreground">
              Nossa equipe vai analisar o cadastro de <strong>{form.razao_social}</strong>. Quando
              for aprovado, você recebe em <strong>{form.email}</strong> o link com o código de
              ativação e o período de teste.
            </p>
            <Button variant="outline" asChild>
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-2xl font-bold">Cadastre sua empresa</h1>
              <p className="text-sm text-muted-foreground">
                Preencha os dados abaixo. Aceitamos CNPJ ou CPF (autônomos e empregadores pessoa
                física).
              </p>
            </div>
            <form className="grid gap-4" onSubmit={onSubmit}>
              <div className="space-y-1">
                <Label htmlFor="documento">CPF ou CNPJ *</Label>
                <Input
                  id="documento"
                  inputMode="numeric"
                  required
                  value={form.documento}
                  onChange={set("documento")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="razao">Nome da empresa (razão social ou nome) *</Label>
                <Input
                  id="razao"
                  required
                  maxLength={255}
                  value={form.razao_social}
                  onChange={set("razao_social")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="resp">Responsável *</Label>
                  <Input
                    id="resp"
                    required
                    maxLength={255}
                    value={form.responsavel}
                    onChange={set("responsavel")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tel">Telefone / WhatsApp</Label>
                  <Input
                    id="tel"
                    type="tel"
                    maxLength={20}
                    value={form.telefone}
                    onChange={set("telefone")}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <div className="space-y-1">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    maxLength={255}
                    value={form.email}
                    onChange={set("email")}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qtd">Nº de funcionários</Label>
                  <Input
                    id="qtd"
                    inputMode="numeric"
                    value={form.qtd_funcionarios}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        qtd_funcionarios: e.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="msg">Mensagem (opcional)</Label>
                <Textarea
                  id="msg"
                  maxLength={1000}
                  value={form.mensagem}
                  onChange={set("mensagem")}
                />
              </div>
              {/* Campo-armadilha para robôs: escondido de pessoas e leitores de tela. */}
              <input
                type="text"
                name="site"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.site}
                onChange={set("site")}
              />
              <p className="text-xs text-muted-foreground">
                Usamos estes dados apenas para analisar o cadastro e falar com você, conforme a
                LGPD.
              </p>
              <Button type="submit" size="lg" className="h-12" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send className="size-4" />} Enviar
                pedido
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem acesso?{" "}
                <Link to="/login" className="font-semibold text-primary underline">
                  Entrar
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
      <p className="mt-6 text-xs text-primary-foreground/70">PontoFlex · NOMANDUZ - TECH and IA</p>
    </main>
  );
}
