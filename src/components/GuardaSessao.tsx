import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/hooks/use-sign-out";
import { avaliarSessao, marcasSessao, POLITICA } from "@/lib/sessao-politica";
import type { Papel } from "@/lib/session";

const EVENTOS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
const MAX_ERROS_DESBLOQUEIO = 5;

/** Encerra ou bloqueia a sessão por inatividade, conforme o perfil (ver sessao-politica.ts). */
export function GuardaSessao({ papel }: { papel: Papel }) {
  const signOut = useSignOut();
  const [travada, setTravada] = useState(() => marcasSessao.travada());
  const travadaRef = useRef(travada);
  travadaRef.current = travada;

  useEffect(() => {
    if (!papel) return;
    marcasSessao.garantir();
    let ultimaGravacao = 0;
    let encerrando = false;

    const atividade = () => {
      if (travadaRef.current) return;
      const t = Date.now();
      if (t - ultimaGravacao < 5000) return;
      ultimaGravacao = t;
      marcasSessao.atividade();
    };
    const verificar = () => {
      if (encerrando) return;
      const r = avaliarSessao(
        papel,
        Date.now(),
        marcasSessao.ultimaAtividade(),
        marcasSessao.loginEm(),
      );
      if (r === "sair") {
        encerrando = true;
        toast.info("Sessão encerrada por segurança (tempo sem uso). Entre novamente.");
        void signOut();
      } else if (r === "bloquear" && !travadaRef.current) {
        marcasSessao.travar();
        setTravada(true);
      } else if (r === "ok" && travadaRef.current && !marcasSessao.travada()) {
        setTravada(false); // desbloqueada em outra aba
      }
    };

    verificar();
    for (const e of EVENTOS) window.addEventListener(e, atividade, { passive: true });
    document.addEventListener("visibilitychange", verificar);
    const id = window.setInterval(verificar, 15_000);
    return () => {
      for (const e of EVENTOS) window.removeEventListener(e, atividade);
      document.removeEventListener("visibilitychange", verificar);
      window.clearInterval(id);
    };
  }, [papel, signOut]);

  if (!travada || !papel) return null;
  return (
    <TelaBloqueada
      minutos={POLITICA[papel].inatividadeMin}
      onDesbloquear={() => {
        marcasSessao.destravar();
        setTravada(false);
      }}
      onSair={() => void signOut()}
    />
  );
}

function TelaBloqueada({
  minutos,
  onDesbloquear,
  onSair,
}: {
  minutos: number;
  onDesbloquear: () => void;
  onSair: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const erros = useRef(0);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) {
        onSair();
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        erros.current += 1;
        if (erros.current >= MAX_ERROS_DESBLOQUEIO) {
          toast.error("Muitas senhas erradas. Entre novamente pelo login.");
          onSair();
          return;
        }
        toast.error("Senha incorreta");
        return;
      }
      onDesbloquear();
    } finally {
      setBusy(false);
      setSenha("");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tela bloqueada"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-hero px-5"
    >
      <div className="w-full max-w-sm space-y-5 rounded-2xl bg-card p-6 shadow-xl">
        <Brand className="text-primary" />
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <LockKeyhole className="size-5" /> Tela bloqueada
          </h1>
          <p className="text-sm text-muted-foreground">
            Bloqueamos por segurança após {minutos} minutos sem uso. Digite a senha da empresa para
            continuar de onde parou.
          </p>
        </div>
        <form className="space-y-3" onSubmit={enviar}>
          <Input
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            aria-label="Senha da empresa"
            placeholder="Senha da empresa"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-11"
          />
          <Button type="submit" size="lg" className="h-12 w-full" disabled={busy || !senha}>
            {busy && <Loader2 className="animate-spin" />} Desbloquear
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={onSair}>
            Sair da conta
          </Button>
        </form>
      </div>
    </div>
  );
}
