import { createFileRoute, Link } from "@tanstack/react-router";
import { sugerirTrocaSenha } from "@/lib/senha";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Fingerprint, CheckCircle2, ScanFace, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FaceCapture } from "@/components/FaceCapture";
import { Consentimento } from "@/components/Consentimento";
import { obterLocalizacao } from "@/lib/localizacao";
import { cadastrarRosto, registrarPonto } from "@/lib/ponto.functions";
import { ESCALAS, isDiaTrabalho, type EscalaCfg } from "@/lib/escala";
import {
  dayKey,
  formatDate,
  formatDuration,
  formatTime,
  jornadaAtual,
  nextTipo,
  TIPOS,
  TIPO_LABEL,
  workedMs,
  type Tipo,
} from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/ponto/")({
  head: () => ({
    meta: [
      { title: "Registrar ponto — PontoFlex" },
      {
        name: "description",
        content: "Registre seu ponto com reconhecimento facial e localização.",
      },
      { property: "og:title", content: "Registrar ponto — PontoFlex" },
      {
        property: "og:description",
        content: "Registre seu ponto com reconhecimento facial e localização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PontoPage,
});

const hhmm = (t: string) => t.slice(0, 5);

function PontoPage() {
  const qc = useQueryClient();
  const cadastrar = useServerFn(cadastrarRosto);
  const registrar = useServerFn(registrarPonto);
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [aceite, setAceite] = useState(false);
  const [recibo, setRecibo] = useState<{
    tipo: Tipo;
    data_hora: string;
    lat: number;
    lng: number;
    confianca: number;
  } | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data } = useQuery({
    queryKey: ["ponto-hoje"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: f } = await supabase
        .from("funcionarios")
        .select("*")
        .eq("user_id", u.user!.id)
        .maybeSingle();
      const since = new Date(Date.now() - 30 * 3600_000).toISOString();
      const { data: pts } = f
        ? await supabase
            .from("pontos")
            .select("tipo, data_hora")
            .eq("funcionario_id", f.id)
            .gte("data_hora", since)
            .order("data_hora")
        : { data: [] };
      return { f, pts: pts ?? [] };
    },
  });

  const ref = now ?? new Date();
  const jornada = data ? jornadaAtual(data.pts, ref) : [];
  const proximo = data ? nextTipo(data.pts, ref) : null;
  const f = data?.f;
  const folga =
    f && now ? !isDiaTrabalho(f as EscalaCfg, dayKey(now)) && jornada.length === 0 : false;

  async function onCadastro(img: string) {
    setBusy(true);
    try {
      await cadastrar({ data: { imagem: img, consentimento: aceite } });
      toast.success(
        "Foto enviada! Assim que o administrador aprovar, você já pode registrar o ponto.",
      );
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setBusy(false);
    }
  }

  async function onSelfie(img: string) {
    if (!proximo) return;
    setBusy(true);
    try {
      const pos = await obterLocalizacao();
      const r = await registrar({ data: { imagem: img, latitude: pos.lat, longitude: pos.lng } });
      setRecibo({
        tipo: r.tipo,
        data_hora: r.data_hora,
        lat: pos.lat,
        lng: pos.lng,
        confianca: r.confianca,
      });
      toast.success(`${TIPO_LABEL[r.tipo]} registrada às ${formatTime(r.data_hora)}`);
      setCamera(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar");
    } finally {
      setBusy(false);
    }
  }

  if (data && f && f.foto_status === "pendente") {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Clock className="mx-auto size-12 text-primary" />
        <h1 className="font-display text-2xl font-bold">Foto em análise</h1>
        <p className="text-muted-foreground">
          Sua foto foi enviada e aguarda a aprovação do administrador. Depois disso, é só enquadrar
          o rosto e piscar para registrar o ponto.
        </p>
      </div>
    );
  }

  if (data && f && (f.foto_status === "sem_foto" || f.foto_status === "recusada")) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-display text-2xl font-bold">Cadastro facial</h1>
        {f.foto_status === "recusada" && (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Sua foto anterior não foi aprovada. Envie uma nova, com boa iluminação e o rosto bem
            enquadrado.
          </p>
        )}
        <p className="text-muted-foreground">
          Olá, {f.nome.split(" ")[0]}! Antes do primeiro registro, cadastre seu rosto. Ele confirma
          sua identidade a cada ponto.
        </p>
        <p className="text-sm text-muted-foreground">
          Fique em um local iluminado, sem óculos escuros ou boné.
        </p>
        <Consentimento checked={aceite} onChange={setAceite} />
        {aceite && (
          <FaceCapture
            onCapture={onCadastro}
            busy={busy}
            dica="Encaixe o rosto no oval e pisque para tirar a foto."
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Olá, {f?.nome.split(" ")[0] ?? "…"}</h1>
        <p className="capitalize text-muted-foreground">
          {now ? formatDate(now, { dateStyle: "full" }) : "\u00a0"}
        </p>
      </div>
      <div className="rounded-2xl bg-primary p-6 text-center text-primary-foreground">
        <div className="font-mono text-5xl font-bold tabular-nums">
          {now
            ? new Intl.DateTimeFormat("pt-BR", {
                timeZone: "America/Sao_Paulo",
                timeStyle: "medium",
              }).format(now)
            : "--:--:--"}
        </div>
        <p className="mt-1 text-sm opacity-80">
          Jornada atual: {now ? formatDuration(workedMs(jornada, now)) : "—"}
        </p>
      </div>

      {f && sugerirTrocaSenha(f.senha_alterada_em) && (
        <Link
          to="/ponto/conta"
          className="block rounded-lg border border-accent bg-accent/10 p-3 text-center text-sm"
        >
          Dica: troque sua senha este mês para manter seu acesso seguro.{" "}
          <b className="underline">Trocar agora</b>
        </Link>
      )}

      {folga && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm">
          Hoje é sua folga pela escala {f?.escala}. Se for trabalhar, o registro conta como hora
          extra.
        </p>
      )}

      <Button
        size="lg"
        className="h-20 w-full bg-accent text-lg font-bold text-accent-foreground hover:bg-accent/90"
        disabled={!proximo || !f}
        onClick={() => setCamera(true)}
      >
        <Fingerprint className="size-6" />
        {proximo ? `Registrar Ponto · ${TIPO_LABEL[proximo]}` : "Jornada encerrada"}
      </Button>
      <p className="-mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <ScanFace className="size-3" /> Com reconhecimento facial e localização
      </p>

      {recibo && (
        <Card className="border-primary">
          <CardContent className="space-y-1 pt-6 text-sm">
            <p className="flex items-center gap-2 font-semibold text-primary">
              <CheckCircle2 className="size-4" /> Comprovante de registro
            </p>
            <p>
              {TIPO_LABEL[recibo.tipo]} — {formatDate(recibo.data_hora)} às{" "}
              {formatTime(recibo.data_hora)}
            </p>
            <p className="text-muted-foreground">
              Rosto confirmado ({(recibo.confianca * 100).toFixed(1)}%)
            </p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" /> {recibo.lat.toFixed(5)}, {recibo.lng.toFixed(5)}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Escala {f ? (ESCALAS[f.escala]?.label ?? f.escala) : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 grid grid-cols-3 text-xs font-medium text-muted-foreground">
            <span>Marcação</span>
            <span className="text-center">Previsto</span>
            <span className="text-right">Registrado</span>
          </div>
          {TIPOS.map((t) => {
            const m = jornada.find((p) => p.tipo === t);
            const prev = f
              ? hhmm(
                  {
                    ENTRADA: f.hora_entrada,
                    SAIDA_ALMOCO: f.hora_saida_almoco,
                    RETORNO_ALMOCO: f.hora_retorno_almoco,
                    SAIDA: f.hora_saida,
                  }[t],
                )
              : "";
            return (
              <div key={t} className="grid grid-cols-3 border-t py-2 text-sm">
                <span>{TIPO_LABEL[t]}</span>
                <span className="text-center font-mono text-muted-foreground">{prev}</span>
                <span className="text-right font-mono font-semibold">
                  {m ? formatTime(m.data_hora) : "—"}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={camera} onOpenChange={(o) => !busy && setCamera(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{proximo ? TIPO_LABEL[proximo] : ""}</DialogTitle>
          </DialogHeader>
          {camera && (
            <FaceCapture
              onCapture={onSelfie}
              busy={busy}
              dica="Encaixe o rosto no oval e pisque. O registro é automático."
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
