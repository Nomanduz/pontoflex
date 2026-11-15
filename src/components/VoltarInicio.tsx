import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/** Botão "Voltar" das páginas públicas (cadastro, ativação, termos, terminal): leva ao login. */
export function VoltarInicio({ label = "Voltar ao login" }: { label?: string }) {
  return (
    <Link
      to="/login"
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
