import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, MapPin, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatTime } from "@/lib/ponto";
import { definirSenhasMestras, listarTerminalLogs } from "@/lib/terminal.functions";
import { configurarCerca } from "@/lib/empresa.functions";
import { supabase } from "@/integrations/supabase/client";
import { obterLocalizacao } from "@/lib/localizacao";

export const Route = createFileRoute("/_authenticated/admin/terminal")({
  head: () => ({
    meta: [
      { title: "Gestão do terminal — PontoFlex" },
      { name: "description", content: "Senhas mestras e atividade do terminal de ponto." },
      { property: "og:title", content: "Gestão do terminal — PontoFlex" },
      { property: "og:description", content: "Senhas mestras e atividade do terminal de ponto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TerminalAdmin,
});

const ACAO_LABEL: Record<string, string> = {
  identificado: "Rosto identificado",
  identificacao_falhou: "Identificação falhou",
  verificacao_indisponivel: "Serviço facial indisponível",
  referencia_indisponivel: "Foto cadastrada indisponível",
  registro: "Ponto registrado",
  registro_negado: "Registro negado",
  cadastro_rosto: "Rosto enviado para aprovação",
  desbloqueio: "Terminal desbloqueado",
  identificacao_rejeitada: 'Funcionário informou "não sou eu"',
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
      await salvar({
        data: { ...(leitura ? { leitura } : {}), ...(cadastro ? { cadastro } : {}) },
      });
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="size-5" /> Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Abra a página{" "}
            <Link to="/terminal" className="font-semibold text-primary underline">
              /terminal
            </Link>{" "}
            no aparelho que ficará na entrada (tablet ou celular) e desbloqueie com o CPF/CNPJ da
            empresa e uma das senhas mestras.
          </p>
          <p>
            <strong className="text-foreground">Senha de leitura:</strong> ativa o modo de registro
            — o funcionário encaixa o rosto no oval e pisca; o sistema identifica, ele confere nome,
            matrícula e CPF e toca em Confirmar.
          </p>
          <p>
            <strong className="text-foreground">Senha de cadastro:</strong> ativa o cadastro facial
            no terminal. O funcionário confirma com a própria senha e a foto só passa a valer depois
            que você aprovar em Funcionários.
          </p>
          <p>Trocar uma senha mestra desconecta os terminais que usavam a senha antiga.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-5" /> Senhas mestras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Senha de leitura (registro de ponto)</Label>
            <Input
              type="password"
              value={leitura}
              onChange={(e) => setLeitura(e.target.value)}
              placeholder="Mínimo 8 caracteres, letras e números"
            />
          </div>
          <div className="space-y-1">
            <Label>Senha de cadastro (novos rostos)</Label>
            <Input
              type="password"
              value={cadastro}
              onChange={(e) => setCadastro(e.target.value)}
              placeholder="Mínimo 8 caracteres, letras e números"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe em branco a senha que não quiser alterar. As senhas ficam criptografadas e não
            podem ser visualizadas depois.
          </p>
          <Button onClick={onSalvar} disabled={saving || (!leitura && !cadastro)}>
            {saving ? "Salvando…" : "Salvar senhas"}
          </Button>
        </CardContent>
      </Card>

      <CercaCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividades recentes do terminal</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {data?.logs.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma atividade ainda.</p>
          )}
          {data?.logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium">{ACAO_LABEL[l.acao] ?? l.acao}</span>
                {l.funcionarios?.nome && (
                  <span className="text-muted-foreground"> · {l.funcionarios.nome}</span>
                )}
                {l.detalhe && (
                  <span className="block text-xs text-muted-foreground">{l.detalhe}</span>
                )}
              </span>
              <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                {formatDate(l.data_hora)} {formatTime(l.data_hora)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function CercaCard() {
  const qc = useQueryClient();
  const salvar = useServerFn(configurarCerca);
  const [raio, setRaio] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: emp } = useQuery({
    queryKey: ["empresa-cerca"],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("latitude, longitude, raio_m")
        .maybeSingle();
      return data;
    },
  });

  async function definirAqui() {
    setBusy(true);
    try {
      const pos = await obterLocalizacao(0);
      await salvar({
        data: { latitude: pos.lat, longitude: pos.lng, raio_m: Number(raio || emp?.raio_m || 200) },
      });
      toast.success("Local da empresa salvo");
      qc.invalidateQueries({ queryKey: ["empresa-cerca"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function remover() {
    setBusy(true);
    try {
      await salvar({ data: { latitude: null, longitude: null, raio_m: null } });
      toast.success("Restrição de local removida");
      qc.invalidateQueries({ queryKey: ["empresa-cerca"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-5" /> Local permitido para o ponto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {emp?.raio_m ? (
          <p>
            Marcações só são aceitas a até <strong>{emp.raio_m} m</strong> do local salvo (
            {Number(emp.latitude).toFixed(5)}, {Number(emp.longitude).toFixed(5)}).
          </p>
        ) : (
          <p className="text-muted-foreground">
            Sem restrição: o ponto é aceito de qualquer lugar (a localização é sempre registrada).
          </p>
        )}
        <div className="space-y-1">
          <Label htmlFor="raio">Raio permitido (metros)</Label>
          <Input
            id="raio"
            inputMode="numeric"
            placeholder={String(emp?.raio_m ?? 200)}
            value={raio}
            onChange={(e) => setRaio(e.target.value.replace(/D/g, ""))}
            className="max-w-40"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Faça isto estando na empresa: o local atual deste aparelho vira o centro da área
          permitida.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={definirAqui} disabled={busy}>
            Usar minha localização atual
          </Button>
          {emp?.raio_m && (
            <Button variant="outline" onClick={remover} disabled={busy}>
              Remover restrição
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
