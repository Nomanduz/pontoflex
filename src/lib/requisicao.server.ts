// Somente servidor: dados da requisição HTTP atual.
import { getRequestHeader } from "@tanstack/react-start/server";

export function ipDaRequisicao(): string {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

/**
 * Endereço público do app para links em e-mails.
 * Ordem: APP_URL (domínio próprio) → domínio de produção que a Vercel informa → endereço da requisição.
 */
export function urlDoApp(): string {
  const env = process.env["APP_URL"]?.replace(/\/+$/, "");
  if (env) return env;
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (vercel) return `https://${vercel}`;
  const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "localhost:8080";
  const proto =
    getRequestHeader("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
