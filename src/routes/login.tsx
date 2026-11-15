import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  Loader2,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { empresaEmail, maskDocumento } from "@/lib/doc";
import { getPapel } from "@/lib/session";
import { marcasSessao } from "@/lib/sessao-politica";
import { loginPorMatricula } from "@/lib/terminal.functions";
import { pedirRedefinicaoSenha } from "@/lib/redefinir.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — PontoFlex" },
      { name: "description", content: "Acesse o PontoFlex como empresa ou funcionário." },
      { property: "og:title", content: "Entrar — PontoFlex" },
      { property: "og:description", content: "Acesse o PontoFlex como empresa ou funcionário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [documento, setDocumento] = useState("");
  const [email, setEmail] = useState("");
  const [aba, setAba] = useState("funcionario");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [esqueci, setEsqueci] = useState(false);
  const [pedidoEnviado, setPedidoEnviado] = useState(false);
  const pedirRedefinicao = useServerFn(pedirRedefinicaoSenha);

  async function pedirLink(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await pedirRedefinicao({ data: { documento } });
      setPedidoEnviado(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function entrar(e: FormEvent, tipo: "admin" | "funcionario" | "superadmin") {
    e.preventDefault();
    setLoading(true);
    try {
      if (tipo === "admin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: empresaEmail(documento),
          password: senha,
        });
        if (error) throw new Error("CPF/CNPJ ou senha inválidos");
      } else if (tipo === "superadmin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: senha,
        });
        if (error) throw new Error("E-mail ou senha inválidos");
      } else {
        const sess = await loginPorMatricula({ data: { documento, matricula, senha } });
        const { error } = await supabase.auth.setSession({
          access_token: sess.access_token,
          refresh_token: sess.refresh_token,
        });
        if (error) throw new Error("Dados de acesso inválidos");
      }
      const { papel } = await getPapel();
      if (papel !== tipo) {
        await supabase.auth.signOut();
        throw new Error(
          tipo === "admin"
            ? "Este acesso não é de uma empresa"
            : tipo === "superadmin"
              ? "Acesso restrito à equipe Nomanduz"
              : "Este acesso não é de um funcionário",
        );
      }
      marcasSessao.iniciar();
      navigate({
        to: tipo === "admin" ? "/admin" : tipo === "superadmin" ? "/nomanduz" : "/ponto",
        replace: true,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const senhaField = (
    <div className="space-y-2">
      <Label htmlFor="senha">Senha</Label>
      <Input
        id="senha"
        type="password"
        required
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="h-11"
      />
    </div>
  );
  const submit = (
    <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
      {loading && <Loader2 className="animate-spin" />} Entrar
    </Button>
  );

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="bg-hero relative hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <Brand />
        <div>
          <h1 className="font-display text-5xl font-bold leading-tight">
            A jornada da sua equipe,
            <br />
            <span className="text-accent">no ponto certo.</span>
          </h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Ponto com reconhecimento facial, localização, controle de jornada e assinatura
            eletrônica da folha.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© PontoFlex · NOMANDUZ - TECH and IA</p>
      </section>

      <section className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 lg:hidden">
          <Brand className="text-primary" />
        </div>
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold">Bem-vindo</h2>
          <p className="mb-6 text-sm text-muted-foreground">Escolha como deseja acessar.</p>
          <Tabs
            value={aba}
            onValueChange={(v) => {
              setAba(v);
              setSenha("");
              setEsqueci(false);
              setPedidoEnviado(false);
            }}
          >
            <TabsList className="mb-6 grid h-11 w-full grid-cols-2">
              <TabsTrigger value="funcionario" className="gap-2">
                <UserRound className="size-4" /> Funcionário
              </TabsTrigger>
              <TabsTrigger value="admin" className="gap-2">
                <Building2 className="size-4" /> Empresa
              </TabsTrigger>
            </TabsList>
            <TabsContent value="funcionario">
              <form className="space-y-4" onSubmit={(e) => entrar(e, "funcionario")}>
                <div className="space-y-2">
                  <Label htmlFor="documento">CPF ou CNPJ da empresa</Label>
                  <Input
                    id="documento"
                    inputMode="numeric"
                    required
                    value={documento}
                    onChange={(e) => setDocumento(maskDocumento(e.target.value))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="matricula">Matrícula</Label>
                  <Input
                    id="matricula"
                    placeholder="Sua matrícula"
                    required
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    className="h-11"
                  />
                </div>
                {senhaField}
                {submit}
                <LinkEsqueci onClick={() => setEsqueci((v) => !v)} />
                {esqueci && (
                  <p className="rounded-lg bg-muted p-3 text-xs">
                    A senha do funcionário é criada pela empresa. Peça ao responsável para gerar uma
                    senha nova em <strong>Funcionários → Redefinir senha</strong>.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  A senha é fornecida pela empresa. Para bater o ponto sem login, use o terminal da
                  empresa.
                </p>
              </form>
            </TabsContent>
            <TabsContent value="admin">
              {esqueci ? (
                <EsqueciEmpresa
                  documento={documento}
                  setDocumento={setDocumento}
                  enviado={pedidoEnviado}
                  loading={loading}
                  onSubmit={pedirLink}
                  onVoltar={() => {
                    setEsqueci(false);
                    setPedidoEnviado(false);
                  }}
                />
              ) : (
                <form className="space-y-4" onSubmit={(e) => entrar(e, "admin")}>
                  <div className="space-y-2">
                    <Label htmlFor="documento">CPF ou CNPJ da empresa</Label>
                    <Input
                      id="documento"
                      inputMode="numeric"
                      required
                      value={documento}
                      onChange={(e) => setDocumento(maskDocumento(e.target.value))}
                      className="h-11"
                    />
                  </div>
                  {senhaField}
                  {submit}
                  <LinkEsqueci onClick={() => setEsqueci(true)} />
                  <p className="text-center text-sm text-muted-foreground">
                    Ainda não usa o PontoFlex?{" "}
                    <Link to="/cadastro" className="font-semibold text-primary underline">
                      Cadastre sua empresa
                    </Link>
                  </p>
                </form>
              )}
            </TabsContent>
            <TabsContent value="superadmin">
              <form className="space-y-4" onSubmit={(e) => entrar(e, "superadmin")}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" /> Acesso equipe Nomanduz
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail da equipe</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                  />
                </div>
                {senhaField}
                {submit}
                <LinkEsqueci onClick={() => setEsqueci((v) => !v)} />
                {esqueci && (
                  <p className="rounded-lg bg-muted p-3 text-xs">
                    Por segurança, o acesso da equipe não tem recuperação pela internet. A senha é
                    redefinida somente pelo responsável técnico da Nomanduz.
                  </p>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setAba("funcionario");
                    setSenha("");
                    setEsqueci(false);
                  }}
                >
                  <ArrowLeft className="size-4" /> Voltar
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          {aba !== "superadmin" && (
            <button
              type="button"
              onClick={() => setAba("superadmin")}
              className="mt-8 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="size-3" /> Acesso equipe Nomanduz
            </button>
          )}
          <Link
            to="/terminal"
            className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <MonitorSmartphone className="size-3" /> Abrir terminal de ponto
          </Link>
        </div>
      </section>
    </main>
  );
}

function LinkEsqueci({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-center text-sm font-medium text-primary hover:underline"
    >
      Esqueci minha senha
    </button>
  );
}

function EsqueciEmpresa(p: {
  documento: string;
  setDocumento: (v: string) => void;
  enviado: boolean;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onVoltar: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Recuperar senha da empresa</h3>
        <p className="text-sm text-muted-foreground">
          Enviamos um link para o e-mail informado no cadastro da empresa.
        </p>
      </div>
      {p.enviado ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          Se o documento estiver cadastrado, o link chega em alguns minutos no e-mail da empresa
          (confira também o spam). Ele vale por 1 hora. Não recebeu? Fale com a equipe PontoFlex
          pelo e-mail <strong>academiadaprevencaobr@gmail.com</strong>.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={p.onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="documento-recuperar">CPF ou CNPJ da empresa</Label>
            <Input
              id="documento-recuperar"
              inputMode="numeric"
              required
              value={p.documento}
              onChange={(e) => p.setDocumento(maskDocumento(e.target.value))}
              className="h-11"
            />
          </div>
          <Button type="submit" size="lg" className="h-12 w-full" disabled={p.loading}>
            {p.loading && <Loader2 className="animate-spin" />} Enviar link
          </Button>
        </form>
      )}
      <Button type="button" variant="ghost" className="w-full" onClick={p.onVoltar}>
        <ArrowLeft className="size-4" /> Voltar ao login
      </Button>
    </div>
  );
}
