import { dayKey, groupByJornada, workedMs, type Marcacao, type Tipo } from "./ponto";

type Def = { label: string; tipo: "semanal"; dias: number[] } | { label: string; tipo: "ciclo"; trabalha: number; folga: number };

/** Supported work schedules. Weekdays: 0 = Sunday … 6 = Saturday. */
export const ESCALAS: Record<string, Def> = {
  "5x2": { label: "5x2 (seg a sex)", tipo: "semanal", dias: [1, 2, 3, 4, 5] },
  "6x1": { label: "6x1 (seg a sáb)", tipo: "semanal", dias: [1, 2, 3, 4, 5, 6] },
  "4x3": { label: "4x3 (seg a qui)", tipo: "semanal", dias: [1, 2, 3, 4] },
  "5x1": { label: "5x1 (revezamento)", tipo: "ciclo", trabalha: 5, folga: 1 },
  "6x2": { label: "6x2 (revezamento)", tipo: "ciclo", trabalha: 6, folga: 2 },
  "12x36": { label: "12x36", tipo: "ciclo", trabalha: 1, folga: 1 },
  "24x48": { label: "24x48", tipo: "ciclo", trabalha: 1, folga: 2 },
  "24x72": { label: "24x72", tipo: "ciclo", trabalha: 1, folga: 3 },
  personalizada: { label: "Personalizada (dias da semana)", tipo: "semanal", dias: [] },
};

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface EscalaCfg {
  escala: string;
  dias_semana: number[] | null;
  escala_inicio: string | null;
  hora_entrada: string;
  hora_saida_almoco: string;
  hora_retorno_almoco: string;
  hora_saida: string;
}

export const isCiclo = (escala: string) => ESCALAS[escala]?.tipo === "ciclo";

const toUtcDay = (key: string) => {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const mins = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};

export function isDiaTrabalho(cfg: EscalaCfg, key: string): boolean {
  const def = ESCALAS[cfg.escala] ?? ESCALAS["5x2"]!;
  if (def.tipo === "semanal") {
    const dias = cfg.escala === "personalizada" ? (cfg.dias_semana ?? []) : def.dias;
    return dias.includes(new Date(toUtcDay(key)).getUTCDay());
  }
  const inicio = cfg.escala_inicio ?? key;
  const diff = Math.round((toUtcDay(key) - toUtcDay(inicio)) / 864e5);
  const ciclo = def.trabalha + def.folga;
  return ((diff % ciclo) + ciclo) % ciclo < def.trabalha;
}

/** Expected work per shift from the configured times; supports shifts crossing midnight. */
export function previstoMs(cfg: EscalaCfg): number {
  const span = (a: string, b: string) => {
    const d = mins(b) - mins(a);
    return d <= 0 ? d + 1440 : d;
  };
  const total = span(cfg.hora_entrada, cfg.hora_saida);
  const intervalo = cfg.hora_saida_almoco === cfg.hora_retorno_almoco ? 0 : span(cfg.hora_saida_almoco, cfg.hora_retorno_almoco);
  return Math.max(0, total - intervalo) * 60_000;
}

/** Closing period: always from day 21 to day 20 of the following month. */
export function periodoDe(key: string): { inicio: string; fim: string } {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const startMonth = d >= 21 ? m - 1 : m - 2; // 0-based month of the start
  return {
    inicio: fromUtcDay(Date.UTC(y, startMonth, 21)),
    fim: fromUtcDay(Date.UTC(y, startMonth + 1, 20)),
  };
}

/** Period that ended most recently (the one usually closed). */
export function ultimoPeriodoFechavel(hoje: string): { inicio: string; fim: string } {
  const atual = periodoDe(hoje);
  return periodoDe(fromUtcDay(toUtcDay(atual.inicio) - 864e5));
}

export function deslocarPeriodo(inicio: string, meses: number) {
  const [y = 1970, m = 1] = inicio.split("-").map(Number);
  return periodoDe(fromUtcDay(Date.UTC(y, m - 1 + meses, 21)));
}

export function diasDoPeriodo(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let t = toUtcDay(inicio); t <= toUtcDay(fim); t += 864e5) out.push(fromUtcDay(t));
  return out;
}

export interface DiaFolha {
  dia: string;
  trabalho: boolean;
  previsto: number;
  trabalhado: number;
  saldo: number;
  falta: boolean;
  marcacoes: { tipo: Tipo; data_hora: string }[];
}

export interface Folha {
  dias: DiaFolha[];
  totais: { previsto: number; trabalhado: number; saldo: number; faltas: number; diasTrabalhados: number };
}

export function montarFolha(cfg: EscalaCfg, pontos: Marcacao[], inicio: string, fim: string, now: Date = new Date()): Folha {
  const jornadas = groupByJornada(pontos);
  const hoje = dayKey(now);
  const prev = previstoMs(cfg);
  const dias = diasDoPeriodo(inicio, fim).map((dia): DiaFolha => {
    const marcacoes = (jornadas.get(dia) ?? []).map((m) => ({ tipo: m.tipo, data_hora: m.data_hora }));
    const trabalho = isDiaTrabalho(cfg, dia);
    const futuro = dia > hoje;
    const previsto = trabalho && !futuro ? prev : 0;
    const trabalhado = workedMs(marcacoes, now);
    const emAndamento = dia === hoje && marcacoes.length > 0 && marcacoes.length < 4;
    const saldo = futuro || emAndamento || (dia === hoje && marcacoes.length === 0) ? 0 : trabalhado - previsto;
    return { dia, trabalho, previsto, trabalhado, saldo, falta: trabalho && dia < hoje && marcacoes.length === 0, marcacoes };
  });
  const sum = (f: (d: DiaFolha) => number) => dias.reduce((s, d) => s + f(d), 0);
  return {
    dias,
    totais: {
      previsto: sum((d) => d.previsto),
      trabalhado: sum((d) => d.trabalhado),
      saldo: sum((d) => d.saldo),
      faltas: dias.filter((d) => d.falta).length,
      diasTrabalhados: dias.filter((d) => d.marcacoes.length > 0).length,
    },
  };
}
