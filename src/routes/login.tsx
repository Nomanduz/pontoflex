import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Building2, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { empresaEmail, maskCnpj } from "@/lib/doc";
import { getPapel } from "@/lib/session";
import { loginPorMatricula } from "@/lib/terminal.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — PontoFlex" },
      { name: "description", content: "Acesse o PontoFlex com o CNPJ da empresa ou o CPF do funcionário." },
      { property: "og:title", content: "Entrar — PontoFlex" },
      { property: "og:description", content: "Acesse o PontoFlex com o CNPJ da empresa ou o CPF do funcionário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");

  async function entrar(e: FormEvent, tipo: "admin" | "funcionario") {
    e.preventDefault();
    setLoading(true);
    try {
      if (tipo === "admin") {
        const { error } = await supabase.auth.signInWithPassword({ email: empresaEmail(cnpj), password: senha });
        if (error) throw new Error("CNPJ ou senha inválidos");
      } else {
        const sess = await loginPorMatricula({ data: { matricula, senha } });
        const { error } = await supabase.auth.setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token });
        if (error) throw new Error("Matrícula ou senha inválidos");
      }
      const { papel } = await getPapel();
      if (papel !== tipo) {
        await supabase.auth.signOut();
        throw new Error(tipo === "admin" ? "Este acesso não é de uma empresa" : "Este acesso não é de um funcionário");
      }
      navigate({ to: tipo === "admin" ? "/admin" : "/ponto", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const senhaField = (
    <div className="space-y-2">
      <Label htmlFor="senha">Senha</Label>
      <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11" />
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
            Registro eletrônico com localização, controle de jornada e indicadores do dia em tempo real.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/60">© PontoFlex</p>
      </section>

      <section className="flex flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 lg:hidden">
          <Brand className="text-primary" />
        </div>
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold">Bem-vindo</h2>
          <p className="mb-6 text-sm text-muted-foreground">Escolha como deseja acessar.</p>
          <Tabs defaultValue="funcionario" onValueChange={() => setSenha("")}>
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
                  <Label htmlFor="matricula">Matrícula</Label>
                  <Input id="matricula" placeholder="Sua matrícula" required value={matricula} onChange={(e) => setMatricula(e.target.value)} className="h-11" />
                </div>
                {senhaField}
                {submit}
                <p className="text-xs text-muted-foreground">A senha é fornecida pela empresa. Para bater o ponto sem login, use o terminal da empresa.</p>
              </form>
            </TabsContent>
            <TabsContent value="admin">
              <form className="space-y-4" onSubmit={(e) => entrar(e, "admin")}>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input id="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} className="h-11" />
                </div>
                {senhaField}
                {submit}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}
