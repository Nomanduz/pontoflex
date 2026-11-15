/**
 * Banco de horas (CLT art. 59, §§ 2º e 5º).
 * Entram: o saldo de cada folha fechada (horas extras − atrasos/faltas) e os lançamentos da
 * empresa (folga compensatória, pagamento de horas, ajuste). As horas a mais são usadas na ordem
 * em que foram feitas; as que passam do prazo de compensação devem ser pagas como extras.
 */
import { somarDias } from "./vinculo";

export type OrigemMov = "folha" | "folga" | "pagamento" | "ajuste";

export interface Movimento {
  data: string;
  minutos: number;
  origem: OrigemMov;
  descricao: string;
}

export interface LinhaExtrato extends Movimento {
  saldo: number;
}

export interface BancoHoras {
  saldo: number;
  extrato: LinhaExtrato[];
  /** Horas a mais que passaram do prazo e ainda não foram usadas: pagar como extra. */
  vencidas: number;
  /** Próximos vencimentos (crédito ainda disponível e data limite). */
  aVencer: { venceEm: string; minutos: number }[];
}

export const ORIGEM_LABEL: Record<OrigemMov, string> = {
  folha: "Folha fechada",
  folga: "Folga compensatória",
  pagamento: "Horas pagas",
  ajuste: "Ajuste",
};

function somarMeses(key: string, meses: number) {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + meses, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

export function calcularBanco(movs: Movimento[], prazoMeses: number, hoje: string): BancoHoras {
  const ordenados = [...movs]
    .filter((m) => m.minutos !== 0)
    .sort((a, b) => a.data.localeCompare(b.data) || b.minutos - a.minutos);
  const creditos: { data: string; restante: number }[] = [];
  let devendo = 0; // horas negativas ainda não compensadas
  let saldo = 0;
  const extrato: LinhaExtrato[] = [];

  for (const m of ordenados) {
    saldo += m.minutos;
    extrato.push({ ...m, saldo });
    if (m.minutos > 0) {
      // Crédito primeiro quita o que a pessoa estava devendo.
      const quita = Math.min(devendo, m.minutos);
      devendo -= quita;
      if (m.minutos - quita > 0) creditos.push({ data: m.data, restante: m.minutos - quita });
    } else {
      let falta = -m.minutos;
      for (const c of creditos) {
        if (!falta) break;
        const usa = Math.min(c.restante, falta);
        c.restante -= usa;
        falta -= usa;
      }
      devendo += falta;
    }
  }

  const abertos = creditos.filter((c) => c.restante > 0);
  const vence = (c: { data: string }) => somarDias(somarMeses(c.data, prazoMeses), 0);
  const vencidas = prazoMeses
    ? abertos.filter((c) => vence(c) < hoje).reduce((s, c) => s + c.restante, 0)
    : 0;
  const aVencer = prazoMeses
    ? abertos
        .filter((c) => vence(c) >= hoje)
        .map((c) => ({ venceEm: vence(c), minutos: c.restante }))
    : [];
  return { saldo, extrato: extrato.reverse(), vencidas, aVencer };
}

/** Saldo de cada folha fechada vira um movimento do banco (data = último dia do período). */
export function movimentosDasFolhas(
  fechamentos: { periodo_inicio: string; periodo_fim: string; resumo: unknown }[],
): Movimento[] {
  return fechamentos.map((f) => {
    const ms = Number(
      (f.resumo as { folha?: { totais?: { saldo?: number } } })?.folha?.totais?.saldo ?? 0,
    );
    const ini = f.periodo_inicio.split("-").reverse().join("/");
    const fim = f.periodo_fim.split("-").reverse().join("/");
    return {
      data: f.periodo_fim,
      minutos: Math.round(ms / 60_000),
      origem: "folha" as const,
      descricao: `Saldo da folha ${ini} a ${fim}`,
    };
  });
}

export function formatarMinutos(min: number, sinal = true): string {
  const a = Math.abs(Math.round(min));
  const txt = `${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
  return min < 0 ? `-${txt}` : sinal && min > 0 ? `+${txt}` : txt;
}

/** "2:30", "2h30" ou "2" (horas) → minutos. */
export function lerHoras(txt: string): number | null {
  const t = txt.trim().replace(",", ".");
  let m = /^(\d{1,3})[:h](\d{1,2})$/i.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})h?$/i.exec(t);
  if (m) return Number(m[1]) * 60;
  return null;
}
