// Somente servidor: senhas mestras, tokens assinados e limite de tentativas.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Banco } from "@/integrations/supabase/banco";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------- Senhas mestras (scrypt com sal) ----------

const SCRYPT_N = 16384;

export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, 32, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function conferirSenha(senha: string, armazenado: string | null | undefined): boolean {
  if (!armazenado) return false;
  const [alg, n, salt, hash] = armazenado.split("$");
  if (alg !== "scrypt" || !n || !salt || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const calculado = scryptSync(senha, Buffer.from(salt, "base64"), esperado.length, {
    N: Number(n),
  });
  return timingSafeEqual(esperado, calculado);
}

// ---------- Tokens assinados (HMAC-SHA256) ----------

function segredo(): string {
  const s = process.env["APP_SECRET"];
  if (!s || s.length < 32)
    throw new Error("APP_SECRET ausente ou curto (mínimo 32 caracteres). Veja .env.example.");
  return s;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Gera um token assinado com tipo e validade; o conteúdo é legível, mas não pode ser alterado. */
export function assinarToken(
  tipo: string,
  dados: Record<string, unknown>,
  validadeSeg: number,
): string {
  const corpo = b64url(
    JSON.stringify({ ...dados, t: tipo, exp: Math.floor(Date.now() / 1000) + validadeSeg }),
  );
  const assinatura = b64url(createHmac("sha256", segredo()).update(corpo).digest());
  return `${corpo}.${assinatura}`;
}

/** Devolve os dados do token ou null se a assinatura, o tipo ou a validade não conferirem. */
export function lerToken<T extends Record<string, unknown>>(
  tipo: string,
  token: unknown,
): T | null {
  if (typeof token !== "string") return null;
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = createHmac("sha256", segredo()).update(corpo).digest();
  const recebida = Buffer.from(assinatura, "base64url");
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as T & {
      t?: string;
      exp?: number;
    };
    if (dados.t !== tipo || typeof dados.exp !== "number" || dados.exp < Date.now() / 1000)
      return null;
    return dados;
  } catch {
    return null;
  }
}

/** Código legível para ativação: 12 caracteres sem ambiguidades (≈60 bits), em blocos de 4. */
export function gerarCodigoAtivacao(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const s = [...bytes].map((b) => chars[b % chars.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export const normalizarCodigo = (c: string) => (c ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---------- Limite de tentativas ----------

type Admin = Banco;

/** Lança erro se a chave já atingiu o limite de falhas na janela. */
export async function exigirAbaixoDoLimite(
  admin: Admin,
  chave: string,
  max: number,
  janelaMin: number,
  mensagem?: string,
) {
  const desde = new Date(Date.now() - janelaMin * 60_000).toISOString();
  const { count } = await admin
    .from("tentativas")
    .select("id", { count: "exact", head: true })
    .eq("chave", chave)
    .gte("criado_em", desde);
  if ((count ?? 0) >= max)
    throw new Error(
      mensagem ?? `Muitas tentativas. Aguarde ${janelaMin} minutos e tente novamente.`,
    );
}

export async function registrarTentativa(admin: Admin, chave: string) {
  await admin.from("tentativas").insert({ chave });
  // Faxina ocasional: registros com mais de 1 dia não servem para nenhum limite.
  if (Math.random() < 0.02) {
    const ontem = new Date(Date.now() - 864e5).toISOString();
    await admin.from("tentativas").delete().lt("criado_em", ontem);
  }
}

export async function limparTentativas(admin: Admin, chave: string) {
  await admin.from("tentativas").delete().eq("chave", chave);
}
