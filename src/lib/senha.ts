import { dayKey } from "./ponto";

const mes = (d: Date | string) => dayKey(d).slice(0, 7);

/** Funcionário pode trocar a senha uma vez por mês (calendário de São Paulo). */
export function podeTrocarSenha(
  alteradaEm: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  return !alteradaEm || mes(alteradaEm) !== mes(agora);
}

/** Sugere a troca (sem bloquear) quando ainda não trocou neste mês. */
export const sugerirTrocaSenha = podeTrocarSenha;

export function validarNovaSenha(s: string): string | null {
  if (s.length < 8) return "A nova senha precisa ter pelo menos 8 caracteres";
  if (s.length > 72) return "A nova senha pode ter no máximo 72 caracteres";
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return "Use letras e números na nova senha";
  return null;
}
