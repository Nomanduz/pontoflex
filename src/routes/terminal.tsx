import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CheckCircle2, Loader2, LockKeyhole, MapPin, ScanFace, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { Camera } from "@/components/Camera";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCnpj } from "@/lib/doc";
import { formatTime, TIPO_LABEL, type Tipo } from "@/lib/ponto";
import { cadastrarRostoTerminal, confirmarPontoTerminal, desbloquearTerminal, identificarRosto, listarSemRosto } from "@/lib/terminal.functions";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Terminal de ponto — PontoFlex" },
      { name: "description", content: "Registro de ponto por reconhecimento facial, sem login." },
      { property: "og:title", content: "Terminal de ponto — PontoFlex" },
      { property: "og:description", content: "Registro de ponto por reconhecimento facial, sem login." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TerminalPage,
});

type Sessao = { cnpj: string; senha: string; modo: "leitura" | "cadastro"; empresa: string };
type Identificado = { id: string; nome: string; matricula: string | null; cpf: string; confianca: number };

function getPos(): Promise<GeolocationPosition> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no-geo"));
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 });
  });
}

function TerminalPage() {
  const desbloquear = useServerFn(desbloquearTerminal);
  const [cnpj, setCnpj] = useState("");
  const [senha, setSenha] = useState("");
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [busy, setBusy] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await desbloquear({ data: { cnpj, senha } });
      setSessao({ cnpj, senha, modo: r.modo, empresa: r.empresa });
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
            <p className="text-sm text-muted-foreground">Desbloqueie com o CNPJ da empresa e a senha mestra.</p>
          </div>
          <form className="space-y-4" onSubmit={entrar}>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" required value={cnpj} onChange={(e) => setCnpj(maskCnpj(e.target.value))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha mestra</Label>
              <Input id="senha" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="h-11" />
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
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="size-3" /> {sessao.empresa}</p>
          <h1 className="font-display text-xl font-bold">{sessao.modo === "leitura" ? "Registro de ponto" : "Cadastro facial"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSessao(null)}>Bloquear</Button>
      </div>
      {sessao.modo === "leitura" ? <ModoLeitura sessao={sessao} /> : <ModoCadastro sessao={sessao} />}
    </main>
  );
}

function ModoLeitura({ sessao }: { sessao: Sessao }) {
  const identificar = useServerFn(identificarRosto);
  const confirmar = useServerFn(confirmarPontoTerminal);
  const [busy, setBusy] = useState(false);
  const [etapa, setEtapa] = useState<"captura" | "confirma" | "sucesso">("captura");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [pessoa, setPessoa] = useState<Identificado | null>(null);
  const [recibo, setRecibo] = useState<{ tipo: Tipo; data_hora: string; nome: string } | null>(null);

  useEffect(() => {
    if (etapa !== "sucesso") return;
    const t = setTimeout(() => { setEtapa("captura"); setPessoa(null); setSelfie(null); setRecibo(null); }, 6000);
    return () => clearTimeout(t);
  }, [etapa]);

  async function onCaptura(img: string) {
    setBusy(true);
    try {
      const r = await identificar({ data: { cnpj: sessao.cnpj, senha: sessao.senha, imagem: img } });
      if (!r.encontrado) {
        toast.error("Rosto não reconhecido. Tente novamente ou procure o administrador.");
        return;
      }
      setSelfie(img);
      setPessoa(r.encontrado);
      setEtapa("confirma");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na identificação");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirma() {
    if (!pessoa || !selfie) return;
    setBusy(true);
    try {
      let pos: GeolocationPosition;
      try {
        pos = await getPos();
      } catch {
        toast.error("Ative a localização do aparelho para registrar o ponto.");
        return;
      }
      const r = await confirmar({
        data: { cnpj: sessao.cnpj, senha: sessao.senha, funcionarioId: pessoa.id, imagem: selfie, latitude: pos.coords.latitude, longitude: pos.coords.longitude },
      });
      setRecibo({ tipo: r.tipo, data_hora: r.data_hora, nome: r.nome });
      setEtapa("sucesso");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar");
      setEtapa("captura");
    } finally {
      setBusy(false);
    }
  }

  if (etapa === "sucesso" && recibo) {
    return (
      <Card className="border-primary">
        <CardContent className="space-y-2 pt-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-primary" />
          <h2 className="font-display text-2xl font-bold">{TIPO_LABEL[recibo.tipo]} registrada</h2>
          <p className="text-lg">{recibo.nome.split(" ")[0]}, seu ponto foi registrado às <span className="font-mono font-bold">{formatTime(recibo.data_hora)}</span>.</p>
          <p className="text-sm text-muted-foreground">Voltando para a captura em instantes…</p>
        </CardContent>
      </Card>
    );
  }

  if (etapa === "confirma" && pessoa) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="flex items-center gap-2 font-semibold text-primary"><ScanFace className="size-5" /> Rosto reconhecido ({Math.round(pessoa.confianca * 100)}%)</p>
          <div className="space-y-1 rounded-xl bg-muted p-4">
            <p className="font-display text-lg font-bold">{pessoa.nome}</p>
            <p className="text-sm text-muted-foreground">Matrícula: <span className="font-mono">{pessoa.matricula ?? "—"}</span></p>
            <p className="text-sm text-muted-foreground">CPF: <span className="font-mono">{pessoa.cpf}</span></p>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> A localização será registrada junto com o ponto.</p>
          <Button size="lg" className="h-16 w-full bg-accent text-lg font-bold text-accent-foreground hover:bg-accent/90" onClick={onConfirma} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-6" />} Confirmar registro
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { setEtapa("captura"); setPessoa(null); }} disabled={busy}>Não sou eu — tentar de novo</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">Posicione o rosto no círculo e toque no botão para se identificar.</p>
      <Camera label="Identificar meu rosto" onCapture={onCaptura} busy={busy} />
    </div>
  );
}

function ModoCadastro({ sessao }: { sessao: Sessao }) {
  const listar = useServerFn(listarSemRosto);
  const cadastrar = useServerFn(cadastrarRostoTerminal);
  const [lista, setLista] = useState<{ id: string; nome: string; matricula: string | null }[] | null>(null);
  const [sel, setSel] = useState<{ id: string; nome: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function carregar() {
    try {
      const r = await listar({ data: { cnpj: sessao.cnpj, senha: sessao.senha } });
      setLista(r.funcionarios);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function onCaptura(img: string) {
    if (!sel) return;
    setBusy(true);
    try {
      const r = await cadastrar({ data: { cnpj: sessao.cnpj, senha: sessao.senha, funcionarioId: sel.id, imagem: img } });
      toast.success(`Rosto de ${r.nome} cadastrado!`);
      setSel(null);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setBusy(false);
    }
  }

  if (sel) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Cadastrando o rosto de <strong>{sel.nome}</strong>. Boa iluminação, sem óculos escuros ou boné.</p>
        <Camera label="Cadastrar rosto" onCapture={onCaptura} busy={busy} allowUpload />
        <Button variant="ghost" className="w-full" onClick={() => setSel(null)} disabled={busy}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Selecione o funcionário que ainda não tem o rosto cadastrado:</p>
      {!lista && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lista?.length === 0 && <p className="rounded-lg bg-muted p-4 text-center text-sm">Todos os funcionários ativos já têm rosto cadastrado.</p>}
      {lista?.map((f) => (
        <Button key={f.id} variant="outline" className="h-14 w-full justify-start gap-3" onClick={() => setSel(f)}>
          <UserPlus className="size-5" />
          <span className="flex flex-col items-start">
            <span className="font-semibold">{f.nome}</span>
            <span className="text-xs text-muted-foreground">Matrícula: {f.matricula ?? "—"}</span>
          </span>
        </Button>
      ))}
    </div>
  );
}
