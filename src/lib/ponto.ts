export const TIPOS = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"] as const;
export type Tipo = (typeof TIPOS)[number];

export const TIPO_LABEL: Record<Tipo, string> = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saída almoço",
  RETORNO_ALMOCO: "Retorno almoço",
  SAIDA: "Saída",
};

export const JORNADA_PADRAO: Record<Tipo, string> = {
  ENTRADA: "08:00",
  SAIDA_ALMOCO: "12:00",
  RETORNO_ALMOCO: "13:00",
  SAIDA: "17:00",
};

export const JORNADA_MS = 8 * 60 * 60 * 1000;
export const TZ = "America/Sao_Paulo";

export interface Marcacao {
  tipo: Tipo;
  data_hora: string;
}

const H = 3600_000;

/**
 * Next allowed punch (mirrors the database trigger). Shifts may cross midnight:
 * an open shift stays open up to 26h; a new ENTRADA is allowed 1h after SAIDA.
 */
export function nextTipo(recentes: Marcacao[], now: Date = new Date()): Tipo | null {
  const last = sortByTime(recentes).at(-1);
  if (!last || +now - +new Date(last.data_hora) > 26 * H) return "ENTRADA";
  if (last.tipo === "SAIDA") return +now - +new Date(last.data_hora) < H ? null : "ENTRADA";
  return TIPOS[TIPOS.indexOf(last.tipo) + 1] ?? null;
}

/** Punches of the shift currently in progress (or just closed), for the "today" view. */
export function jornadaAtual<T extends Marcacao>(recentes: T[], now: Date = new Date()): T[] {
  const list = sortByTime(recentes).filter((m) => +now - +new Date(m.data_hora) <= 26 * H);
  const i = list.map((m) => m.tipo).lastIndexOf("ENTRADA");
  return i < 0 ? [] : list.slice(i);
}

/** Groups punches into shifts keyed by the day of their ENTRADA. */
export function groupByJornada<T extends Marcacao>(list: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  let key: string | null = null;
  for (const m of sortByTime(list)) {
    if (m.tipo === "ENTRADA" || key == null) key = dayKey(m.data_hora);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return map;
}

export function sortByTime<T extends Marcacao>(list: T[]): T[] {
  return [...list].sort((a, b) => +new Date(a.data_hora) - +new Date(b.data_hora));
}

/** (saida_almoco - entrada) + (saida - retorno); an open period counts until `now`. */
export function workedMs(doDia: Marcacao[], now: Date = new Date()): number {
  const t: Partial<Record<Tipo, number>> = {};
  for (const m of doDia) t[m.tipo] = +new Date(m.data_hora);
  let total = 0;
  if (t.ENTRADA != null) total += (t.SAIDA_ALMOCO ?? +now) - t.ENTRADA;
  if (t.RETORNO_ALMOCO != null) total += (t.SAIDA ?? +now) - t.RETORNO_ALMOCO;
  return Math.max(0, total);
}

/** YYYY-MM-DD in São Paulo time. */
export function dayKey(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
}

/** Start of the São Paulo day (UTC-3, no DST) as a Date. */
export function startOfDay(now: Date = new Date()): Date {
  const [y = 1970, m = 1, d = 1] = dayKey(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 3));
}

export function groupByDay<T extends Marcacao>(list: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const m of sortByTime(list)) {
    const k = dayKey(m.data_hora);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  }
  return map;
}

export function isWeekday(key: string): boolean {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd !== 0 && wd !== 6;
}

/** Balance for a day: worked minus 8h on weekdays; all worked time counts as extra on weekends. */
export function saldoDia(key: string, doDia: Marcacao[], now: Date = new Date()): number {
  return workedMs(doDia, now) - (isWeekday(key) ? JORNADA_MS : 0);
}

export interface PresencaFuncionario {
  id: string;
  ativo: boolean;
}

/** Present = active with an ENTRADA today; absent = active without one. */
export function presenca(
  funcionarios: PresencaFuncionario[],
  hoje: { funcionario_id: string; tipo: Tipo }[],
) {
  const ativos = funcionarios.filter((f) => f.ativo);
  const comEntrada = new Set(hoje.filter((p) => p.tipo === "ENTRADA").map((p) => p.funcionario_id));
  const presentes = ativos.filter((f) => comEntrada.has(f.id)).length;
  return { total: funcionarios.length, presentes, ausentes: ativos.length - presentes };
}

export function formatDuration(ms: number): string {
  const neg = ms < 0;
  const mins = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${neg ? "-" : ""}${h}h${m.toString().padStart(2, "0")}`;
}

export function formatTime(d: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function formatDate(
  d: string | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "short" },
): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function formatKey(
  key: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "2-digit", month: "2-digit" },
): string {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}
