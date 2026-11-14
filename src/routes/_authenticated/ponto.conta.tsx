import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trocarMinhaSenha } from "@/lib/conta.functions";
import { podeTrocarSenha } from "@/lib/senha";
import { formatDate } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/ponto/conta")({
  head: () => ({
    meta: [
      { title: "Minha senha — PontoFlex" },
      { name: "description", content: "Troque sua senha de acesso ao PontoFlex." },
      { property: "og:title", content: "Minha senha — PontoFlex" },
      { property: "og:description", content: "Troque sua senha de acesso ao PontoFlex." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conta,
});

function Conta() {
  const qc = useQueryClient();
  const trocar = useServerFn(trocarMinhaSenha);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: f } = useQuery({
    queryKey: ["meu-func"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      return (
        await supabase
          .from("funcionarios")
          .select("nome, matricula, senha_alterada_em")
          .eq("user_id", u.user!.id)
          .maybeSingle()
      ).data;
    },
  });
  const pode = podeTrocarSenha(f?.senha_alterada_em);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== conf) {
      toast.error("A confirmação não confere com a nova senha");
      return;
    }
    setBusy(true);
    try {
      await trocar({ data: { atual, nova } });
      toast.success("Senha trocada com sucesso!");
      setAtual("");
      setNova("");
      setConf("");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao trocar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold">Minha senha</h1>
      <p className="text-sm text-muted-foreground">
        Você pode trocar sua senha uma vez por mês.{" "}
        {f?.senha_alterada_em
          ? `Última troca: ${formatDate(f.senha_alterada_em)}.`
          : "Você ainda usa a senha fornecida pela empresa."}
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          {pode ? (
            <form onSubmit={salvar} className="space-y-3">
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
                  Mínimo 8 caracteres, com letras e números.
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
            </form>
          ) : (
            <p className="text-sm">
              Você já trocou sua senha este mês. A próxima troca fica liberada no início do mês que
              vem.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
