/**
 * Tempo de sessão por perfil, para o app não ficar aberto e acessível a terceiros.
 * - Equipe Nomanduz (acesso a todas as empresas): encerra rápido.
 * - Empresa: bloqueia a tela e pede a senha para continuar de onde parou.
 * - Funcionário: encerra a sessão (no padrão dos apps de ponto web).
 */
import type { Papel } from "./session";

export type AcaoSessao = "ok" | "bloquear" | "sair";

export const POLITICA: Record<
  Exclude<Papel, null>,
  { inatividadeMin: number; acao: "bloquear" | "sair"; maxHoras: number }
> = {
  superadmin: { inatividadeMin: 10, acao: "sair", maxHoras: 8 },
  admin: { inatividadeMin: 15, acao: "bloquear", maxHoras: 12 },
  funcionario: { inatividadeMin: 30, acao: "sair", maxHoras: 12 },
};

export function avaliarSessao(
  papel: Papel,
  agora: number,
  ultimaAtividade: number,
  loginEm: number,
): AcaoSessao {
  if (!papel) return "ok";
  const p = POLITICA[papel];
  // Valores ausentes ou corrompidos contam como sessão vencida (lado seguro).
  if (!Number.isFinite(loginEm) || !Number.isFinite(ultimaAtividade)) return "sair";
  if (agora - loginEm > p.maxHoras * 3600_000) return "sair";
  if (agora - ultimaAtividade > p.inatividadeMin * 60_000) return p.acao;
  return "ok";
}

// ---------- Marcas guardadas no aparelho (compartilhadas entre abas) ----------
const CHAVES = {
  login: "pontoflex.sessao.login",
  atividade: "pontoflex.sessao.atividade",
  travada: "pontoflex.sessao.travada",
} as const;

function ler(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravar(k: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* navegador sem armazenamento */
  }
}

export const marcasSessao = {
  /** Chamado ao entrar: começa a contar do zero. */
  iniciar() {
    const t = String(Date.now());
    gravar(CHAVES.login, t);
    gravar(CHAVES.atividade, t);
    gravar(CHAVES.travada, null);
  },
  limpar() {
    gravar(CHAVES.login, null);
    gravar(CHAVES.atividade, null);
    gravar(CHAVES.travada, null);
  },
  /** Sessões abertas antes desta versão não têm marcas: começam a contar agora. */
  garantir() {
    if (!ler(CHAVES.login)) this.iniciar();
  },
  atividade() {
    gravar(CHAVES.atividade, String(Date.now()));
  },
  loginEm: () => Number(ler(CHAVES.login)),
  ultimaAtividade: () => Number(ler(CHAVES.atividade)),
  travada: () => ler(CHAVES.travada) === "1",
  travar: () => gravar(CHAVES.travada, "1"),
  destravar() {
    gravar(CHAVES.travada, null);
    gravar(CHAVES.atividade, String(Date.now()));
  },
};
