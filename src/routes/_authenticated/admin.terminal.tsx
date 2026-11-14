import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTime } from "@/lib/ponto";
import { definirSenhasMestras, listarTerminalLogs } from "@/lib/terminal.functions";

export const Route = createFileRoute("/_authenticated/admin/terminal")({
  head: () => ({ meta: [{ title: "Gestão do terminal — PontoFlex" }, { name: "description", content: "Senhas mestras e atividade do terminal de ponto." }, { property: "og:title", content: "Gestão do terminal — PontoFlex" }, { property: "og:description", content: "Senhas mestras e atividade do terminal de ponto." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TerminalAdmin,
});

const ACAO_LABEL: Record<string, string> = {
  identificado: "Rosto identificado",
  identificacao_falhou: "Identificação falhou",
  verificacao_indisponivel: "Serviço facial indisponível",
  referencia_indisponivel: "Foto cadastrada indisponível",
  registro: "Ponto registrado",
  registro_negado: "Registro negado",
  cadastro_rosto: "Rosto cadastrado",
};

function TerminalAdmin() {
  const qc = useQueryClient();
  const salvar = useServerFn(definirSenhasMestras);
  const listar = useServerFn(listarTerminalLogs);
  const [leitura, setLeitura] = useState("");
  const [cadastro, setCadastro] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["terminal-logs"],
    refetchInterval: 30_000,
    queryFn: () => listar({}),
  });

  async function onSalvar() {
    setSaving(true);
    try {
      await salvar({ data: { ...(leitura ? { leitura } : {}), ...(cadastro ? { cadastro } : {}) } });
      toast.success("Senhas mestras salvas");
      setLeitura("");
      setCadastro("");
      qc.invalidateQueries({ queryKey: ["terminal-logs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Terminal de ponto</h1>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="size-5" /> Como funciona</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Abra a página <Link to="/terminal" className="font-semibold text-primary underline">/terminal</Link> no aparelho que ficará na entrada (tablet ou celular) e desbloqueie com o CNPJ da empresa e uma das senhas mestras.</p>
          <p><strong className="text-foreground">Senha de leitura:</strong> ativa o modo de registro — o funcionário se identifica pelo rosto, confirma nome/matrícula/CPF e o ponto é registrado, sem login.</p>
          <p><strong className="text-foreground">Senha de cadastro:</strong> ativa o modo de cadastro facial de novos funcionários no terminal.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-5" /> Senhas mestras</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Senha de leitura (registro de ponto)</Label>
            <Input type="password" value={leitura} onChange={(e) => setLeitura(e.target.value)} placeholder="Mínimo 4 caracteres" />
          </div>
          <div className="space-y-1">
            <Label>Senha de cadastro (novos rostos)</Label>
            <Input type="password" value={cadastro} onChange={(e) => setCadastro(e.target.value)} placeholder="Mínimo 4 caracteres" />
          </div>
          <p className="text-xs text-muted-foreground">Deixe em branco a senha que não quiser alterar. As senhas ficam criptografadas e não podem ser visualizadas depois.</p>
          <Button onClick={onSalvar} disabled={saving || (!leitura && !cadastro)}>{saving ? "Salvando…" : "Salvar senhas"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Atividades recentes do terminal</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {data?.logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>}
          {data?.logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium">{ACAO_LABEL[l.acao] ?? l.acao}</span>
                {l.funcionarios?.nome && <span className="text-muted-foreground"> · {l.funcionarios.nome}</span>}
                {l.detalhe && <span className="block text-xs text-muted-foreground">{l.detalhe}</span>}
              </span>
              <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatDate(l.data_hora)} {formatTime(l.data_hora)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
