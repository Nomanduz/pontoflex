import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { testarEmail } from "@/lib/nomanduz.functions";

type Resultado = Awaited<ReturnType<typeof testarEmail>>;

/** Painel Nomanduz: envia um e-mail de teste e mostra o motivo exato de qualquer falha. */
export function TesteEmail() {
  const testar = useServerFn(testarEmail);
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setR(await testar({}));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enviar
        e-mail de teste
      </Button>
      {r && (
        <div
          className={`rounded-lg p-3 text-sm ${r.ok ? "bg-primary/10" : "bg-destructive/10 text-destructive"}`}
        >
          <p className="font-semibold">
            {r.ok ? `Enviado para ${r.para}. Confira a caixa de entrada.` : `Falhou: ${r.erro}`}
          </p>
          <p className="text-xs">Resend: {r.config.resend}</p>
          <p className="text-xs">Remetente: {r.config.remetente}</p>
          <p className="text-xs">SMTP: {r.config.smtp}</p>
        </div>
      )}
    </div>
  );
}
