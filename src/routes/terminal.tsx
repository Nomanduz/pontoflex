import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  MapPin,
  ScanFace,
  UserPlus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { Consentimento } from "@/components/Consentimento";
import { FaceCapture } from "@/components/FaceCapture";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskDocumento } from "@/lib/doc";
import { acompanharLocalizacao, obterLocalizacao } from "@/lib/localizacao";
import { formatTime, TIPO_LABEL, type Tipo } from "@/lib/ponto";
import {
  cadastrarRostoTerminal,
  confirmarPontoTerminal,
  desbloquearTerminal,
  identificarRosto,
  listarSemRosto,
  recusarIdentificacao,
} from "@/lib/terminal.functions";

export const Route = createFileRoute("/terminal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terminal de ponto — PontoFlex" },
      { name: "description", content: "Registro de ponto por reconhecimento facial, sem login." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TerminalPage,
});

type Sessao = { token: string; modo: "leitura" | "cadastro"; empresa: string };
type Identificado = {
  nome: string;
  matricula: string;
  cpf: string;
  tipo: Tipo | null;
  tipoLabel: string | null;
  similaridade: number;
  confirmacao: string;
};

const CHAVE = "pontoflex.terminal";
function lerSessao(): Sessao | null {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Sessao | null;
    return s?.token ? s : null;
  } catch {
    return null;
  }
}
function salvarSessao(s: Sessao | null) {
  try {
    if (s) localStorage.setItem(CHAVE, JSON.stringify(s));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem armazenamento: a sessão vale até recarregar */
  }
}
const expirou = (e: unknown) => e instanceof Error && e.message.includes("Desbloqueie novamente");

function TerminalPage() {
  const desbloquear = useServerFn(desbloquearTerminal);
  const [documento, setDocumento] = useState("");
  const [senha, setSenha] = useState("");
  const [sessao, setSessao] = useState<Sessao | null>(() => lerSessao());
  const [busy, setBusy] = useState(false);

  function trocar(s: Sessao | null) {
    salvarSessao(s);
    setSessao(s);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await desbloquear({ data: { documento, senha } });
      trocar({ token: r.token, modo: r.modo, empresa: r.empresa });
      setSenha("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desbloquear");
    } finally {
      setBusy(false);
    }
  }

  if (!sessao) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-hero px-5 py-10">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-card p-6 shadow-xl">
          <Brand className="text-primary" />
          <div>
            <h1 className="font-display text-xl font-bold">Terminal de ponto</h1>
            <p className="text-sm text-muted-foreground">
              Desbloqueie com o CPF/CNPJ da empresa e a senha mestra.
            </p>
          </div>
          <form className="space-y-4" onSubmit={entrar}>
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
              <Label htmlFor="senha">Senha mestra</Label>
              <Input
                id="senha"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Desbloquear terminal
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3" /> {sessao.empresa}
          </p>
          <h1 className="font-display text-xl font-bold">
            {sessao.modo === "leitura" ? "Registro de ponto" : "Cadastro facial"}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => trocar(null)}>
          Bloquear
        </Button>
      </div>
      {sessao.modo === "leitura" ? (
        <ModoLeitura sessao={sessao} onExpirar={() => trocar(null)} />
      ) : (
        <ModoCadastro sessao={sessao} onExpirar={() => trocar(null)} />
      )}
    </main>
  );
}

function Relogio() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <p className="font-mono text-5xl font-bold tabular-nums">
        {agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
      </p>
      <p className="text-sm capitalize text-muted-foreground">
        {agora.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          timeZone: "America/Sao_Paulo",
        })}
      </p>
    </div>
  );
}

function ModoLeitura({ sessao, onExpirar }: { sessao: Sessao; onExpirar: () => void }) {
  const identificar = useServerFn(identificarRosto);
  const confirmar = useServerFn(confirmarPontoTerminal);
  const recusar = useServerFn(recusarIdentificacao);
  const [busy, setBusy] = useState(false);
  const [etapa, setEtapa] = useState<"captura" | "confirma" | "sucesso">("captura");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<Identificado | null>(null);
  const [recibo, setRecibo] = useState<{ tipo: Tipo; data_hora: string; nome: string } | null>(
    null,
  );
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => acompanharLocalizacao(), []);

  function voltar() {
    setEtapa("captura");
    setPessoa(null);
    setSelfie(null);
    setRecibo(null);
  }

  useEffect(() => {
    if (etapa === "captura") return;
    // Confirmação esquecida aberta volta sozinha; o comprovante some após alguns segundos.
    const t = setTimeout(voltar, etapa === "sucesso" ? 6000 : 30000);
    return () => clearTimeout(t);
  }, [etapa]);

  function falha(e: unknown, padrao: string) {
    if (expirou(e)) {
      toast.error("Sessão do terminal expirou.");
      onExpirar();
      return;
    }
    setAviso(e instanceof Error ? e.message : padrao);
  }

  async function onCaptura(img: string) {
    setBusy(true);
    setAviso(null);
    try {
      const r = await identificar({ data: { token: sessao.token, imagem: img } });
      if (!r.encontrado) {
        setAviso(
          "semRostosAprovados" in r && r.semRostosAprovados
            ? "Nenhum rosto foi aprovado ainda. O administrador precisa aprovar as fotos em Funcionários → Aprovar foto."
            : "Rosto não reconhecido. Se você cadastrou o rosto agora, aguarde a aprovação do administrador ou procure o RH.",
        );
        return;
      }
      setSelfie(img);
      setPessoa(r.encontrado);
      setEtapa("confirma");
    } catch (e) {
      falha(e, "Erro na identificação");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirma() {
    if (!pessoa) return;
    setBusy(true);
    try {
      const pos = await obterLocalizacao();
      const r = await confirmar({
        data: {
          token: sessao.token,
          confirmacao: pessoa.confirmacao,
          latitude: pos.lat,
          longitude: pos.lng,
        },
      });
      setRecibo({ tipo: r.tipo, data_hora: r.data_hora, nome: r.nome });
      setEtapa("sucesso");
    } catch (e) {
      falha(e, "Erro ao registrar");
      voltar();
    } finally {
      setBusy(false);
    }
  }

  async function naoSouEu() {
    if (pessoa)
      recusar({ data: { token: sessao.token, confirmacao: pessoa.confirmacao } }).catch(() => {});
    voltar();
  }

  if (etapa === "sucesso" && recibo) {
    return (
      <Card className="border-primary">
        <CardContent className="space-y-2 pt-8 text-center">
          <CheckCircle2 className="mx-auto size-16 text-primary" />
          <h2 className="font-display text-2xl font-bold">{TIPO_LABEL[recibo.tipo]} registrada</h2>
          <p className="text-lg">
            {recibo.nome.split(" ")[0]}, seu ponto foi registrado às{" "}
            <span className="font-mono font-bold">{formatTime(recibo.data_hora)}</span>.
          </p>
          <p className="text-sm text-muted-foreground">Voltando para a leitura em instantes…</p>
        </CardContent>
      </Card>
    );
  }

  if (etapa === "confirma" && pessoa) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <ScanFace className="size-5" /> Confira seus dados
          </p>
          <div className="flex gap-4 rounded-xl bg-muted p-4">
            {selfie && (
              <img
                src={selfie}
                alt="Foto capturada"
                className="h-24 w-[72px] shrink-0 -scale-x-100 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-display text-lg font-bold leading-tight">{pessoa.nome}</p>
              <p className="text-sm text-muted-foreground">
                Matrícula: <span className="font-mono">{pessoa.matricula}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                CPF: <span className="font-mono">{pessoa.cpf}</span>
              </p>
            </div>
          </div>
          {pessoa.tipoLabel ? (
            <p className="rounded-lg border-2 border-primary p-3 text-center text-lg font-bold">
              Registrar: {pessoa.tipoLabel}
            </p>
          ) : (
            <p className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
              Jornada encerrada há menos de 1 hora. Aguarde para a próxima entrada.
            </p>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> A localização e a foto ficam registradas junto com o
            ponto.
          </p>
          <Button
            size="lg"
            className="h-16 w-full bg-accent text-lg font-bold text-accent-foreground hover:bg-accent/90"
            onClick={onConfirma}
            disabled={busy || !pessoa.tipo}
          >
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-6" />}{" "}
            Confirmar registro
          </Button>
          <Button variant="ghost" className="w-full" onClick={naoSouEu} disabled={busy}>
            <XCircle className="size-4" /> Não sou eu
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Relogio />
      <FaceCapture
        onCapture={onCaptura}
        busy={busy}
        ativo={etapa === "captura"}
        dica="Encaixe o rosto no oval e pisque. A identificação é automática."
      />
      {aviso && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive"
        >
          {aviso}
        </p>
      )}
    </div>
  );
}

function ModoCadastro({ sessao, onExpirar }: { sessao: Sessao; onExpirar: () => void }) {
  const listar = useServerFn(listarSemRosto);
  const cadastrar = useServerFn(cadastrarRostoTerminal);
  const [lista, setLista] = useState<
    { id: string; nome: string; matricula: string; foto_status: string }[] | null
  >(null);
  const [sel, setSel] = useState<{ id: string; nome: string } | null>(null);
  const [senhaFunc, setSenhaFunc] = useState("");
  const [aceite, setAceite] = useState(false);
  const [liberado, setLiberado] = useState(false);
  const [busy, setBusy] = useState(false);

  async function carregar() {
    try {
      const r = await listar({ data: { token: sessao.token } });
      setLista(r.funcionarios);
    } catch (e) {
      if (expirou(e)) {
        onExpirar();
        return;
      }
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }
  useEffect(() => {
    carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  function sair() {
    setSel(null);
    setSenhaFunc("");
    setAceite(false);
    setLiberado(false);
  }

  async function onCaptura(img: string) {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await cadastrar({
        data: {
          token: sessao.token,
          funcionarioId: sel.id,
          senhaFuncionario: senhaFunc,
          consentimento: aceite,
          imagem: img,
        },
      });
      toast.success(`Rosto de ${r.nome} enviado! Aguarda aprovação do administrador.`);
      sair();
      carregar();
    } catch (e) {
      if (expirou(e)) {
        onExpirar();
        return;
      }
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
      if (e instanceof Error && e.message.includes("Senha")) setLiberado(false);
    } finally {
      setBusy(false);
    }
  }

  if (sel && liberado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Cadastrando o rosto de <strong>{sel.nome}</strong>. Boa iluminação, sem óculos escuros ou
          boné.
        </p>
        <FaceCapture
          onCapture={onCaptura}
          busy={busy}
          dica="Encaixe o rosto no oval e pisque para tirar a foto."
        />
        <Button variant="ghost" className="w-full" onClick={sair} disabled={busy}>
          Cancelar
        </Button>
      </div>
    );
  }

  if (sel) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setLiberado(true);
        }}
      >
        <p className="text-sm">
          Olá, <strong>{sel.nome}</strong>. Para cadastrar seu rosto, confirme com a{" "}
          <strong>sua senha</strong> de funcionário.
        </p>
        <div className="space-y-2">
          <Label htmlFor="senha-func">Sua senha</Label>
          <Input
            id="senha-func"
            type="password"
            required
            autoComplete="off"
            value={senhaFunc}
            onChange={(e) => setSenhaFunc(e.target.value)}
            className="h-11"
          />
        </div>
        <Consentimento checked={aceite} onChange={setAceite} />
        <Button type="submit" size="lg" className="h-12 w-full" disabled={!senhaFunc || !aceite}>
          Continuar
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={sair}>
          Voltar
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Selecione seu nome para cadastrar o rosto:</p>
      {!lista && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lista?.length === 0 && (
        <p className="rounded-lg bg-muted p-4 text-center text-sm">
          Todos os funcionários ativos já enviaram o rosto.
        </p>
      )}
      {lista?.map((f) => (
        <Button
          key={f.id}
          variant="outline"
          className="h-14 w-full justify-start gap-3"
          onClick={() => setSel(f)}
        >
          <UserPlus className="size-5" />
          <span className="flex flex-col items-start">
            <span className="font-semibold">{f.nome}</span>
            <span className="text-xs text-muted-foreground">
              Matrícula: {f.matricula}
              {f.foto_status === "recusada" ? " · foto anterior recusada" : ""}
            </span>
          </span>
        </Button>
      ))}
    </div>
  );
}
