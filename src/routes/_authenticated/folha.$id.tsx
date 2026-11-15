import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GuardaSessao } from "@/components/GuardaSessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolhaTabela } from "@/components/FolhaTabela";
import { assinarFolha } from "@/lib/fechamento.functions";
import { ESCALAS, type Folha } from "@/lib/escala";
import { formatDate, formatKey, formatTime } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/folha/$id")({
  head: () => ({
    meta: [
      { title: "Folha de ponto — PontoFlex" },
      { name: "description", content: "Folha de ponto do período com assinaturas eletrônicas." },
      { property: "og:title", content: "Folha de ponto — PontoFlex" },
      {
        property: "og:description",
        content: "Folha de ponto do período com assinaturas eletrônicas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FolhaPage,
});

type Resumo = {
  empresa: { razao_social: string; documento?: string; tipo_documento?: string; cnpj?: string };
  funcionario: { nome: string; cpf: string; cargo: string | null; matricula: string | null };
  escala: {
    escala: string;
    hora_entrada: string;
    hora_saida_almoco: string;
    hora_retorno_almoco: string;
    hora_saida: string;
  };
  folha: Folha;
};

function FolhaPage() {
  const { id } = Route.useParams();
  const { papel } = Route.useRouteContext();
  const qc = useQueryClient();
  const assinar = useServerFn(assinarFolha);
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: fc, isLoading } = useQuery({
    queryKey: ["folha", id],
    queryFn: async () =>
      (await supabase.from("fechamentos").select("*").eq("id", id).maybeSingle()).data,
  });
  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando…</p>;
  if (!fc) return <p className="p-6">Folha não encontrada.</p>;
  const r = fc.resumo as unknown as Resumo;
  const fmt = (k: string) => formatKey(k, { day: "2-digit", month: "2-digit", year: "numeric" });
  const quando = (t: string) => `${formatDate(t)} às ${formatTime(t)}`;
  const podeAssinar =
    papel === "admin" ? !!fc.func_assinado_em && !fc.empresa_assinado_em : !fc.func_assinado_em;

  async function onAssinar() {
    setBusy(true);
    try {
      let lat: number | null = null,
        lng: number | null = null;
      if (papel !== "admin") {
        await new Promise<void>(
          (res) =>
            navigator.geolocation?.getCurrentPosition(
              (p) => {
                lat = p.coords.latitude;
                lng = p.coords.longitude;
                res();
              },
              () => res(),
              { timeout: 8000 },
            ) ?? res(),
        );
      }
      await assinar({ data: { id, senha, hash: fc!.hash, latitude: lat, longitude: lng } });
      toast.success("Folha assinada");
      setSenha("");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao assinar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
      <GuardaSessao papel={papel} />
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" asChild>
          <Link to={papel === "admin" ? "/admin/fechamento" : "/ponto/folhas"}>
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Imprimir / PDF
        </Button>
      </div>
      <header className="space-y-1 border-b pb-4">
        <h1 className="font-display text-xl font-bold">
          Folha de ponto — {fmt(fc.periodo_inicio)} a {fmt(fc.periodo_fim)}
        </h1>
        <p className="text-sm">
          {r.empresa.razao_social} · {r.empresa.tipo_documento ?? "CNPJ"}{" "}
          {r.empresa.documento ?? r.empresa.cnpj}
        </p>
        <p className="text-sm">
          {r.funcionario.nome} · CPF {r.funcionario.cpf}
          {r.funcionario.cargo ? ` · ${r.funcionario.cargo}` : ""}
          {r.funcionario.matricula ? ` · Matrícula ${r.funcionario.matricula}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          Escala {ESCALAS[r.escala.escala]?.label ?? r.escala.escala} ·{" "}
          {r.escala.hora_entrada.slice(0, 5)}–{r.escala.hora_saida_almoco.slice(0, 5)} /{" "}
          {r.escala.hora_retorno_almoco.slice(0, 5)}–{r.escala.hora_saida.slice(0, 5)}
        </p>
      </header>

      <FolhaTabela folha={r.folha} />

      <section className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="font-semibold">Funcionário</p>
          {fc.func_assinado_em ? (
            <p className="flex items-start gap-1 text-primary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Assinado eletronicamente por{" "}
              {r.funcionario.nome} em {quando(fc.func_assinado_em)}
              {fc.func_ip ? ` · IP ${fc.func_ip}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">Pendente</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="font-semibold">Empresa</p>
          {fc.empresa_assinado_em ? (
            <p className="flex items-start gap-1 text-primary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Assinado eletronicamente por{" "}
              {r.empresa.razao_social} em {quando(fc.empresa_assinado_em)}
              {fc.empresa_ip ? ` · IP ${fc.empresa_ip}` : ""}
            </p>
          ) : (
            <p className="text-muted-foreground">Pendente</p>
          )}
        </div>
        <p className="break-all text-xs text-muted-foreground sm:col-span-2">
          Fechada em {quando(fc.fechado_em)} · Código de autenticidade: {fc.hash}. Assinatura
          eletrônica simples, com reconfirmação de senha, data/hora e IP (MP 2.200-2/2001, art. 10,
          § 2º). Espelho de ponto para conferência; não substitui os arquivos fiscais AFD/AEJ da
          Portaria MTP nº 671/2021.
        </p>
      </section>

      {podeAssinar && (
        <section className="space-y-3 rounded-xl border-2 border-primary p-4 print:hidden">
          <p className="text-sm">
            {papel === "admin"
              ? "Confirme a folha já assinada pelo funcionário com a senha da empresa."
              : "Confira todas as marcações. Ao assinar, você declara que as informações estão corretas. Se houver erro, fale com o administrador antes de assinar."}
          </p>
          <div className="space-y-1">
            <Label htmlFor="senha-assinatura">Sua senha</Label>
            <Input
              id="senha-assinatura"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <Button className="w-full" disabled={!senha || busy} onClick={onAssinar}>
            <ShieldCheck className="size-4" /> {busy ? "Assinando…" : "Assinar folha"}
          </Button>
        </section>
      )}
    </main>
  );
}
