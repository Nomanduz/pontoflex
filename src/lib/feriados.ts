/** Feriados nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023) e a Sexta-feira Santa. */
const FIXOS: Record<string, string> = {
  "01-01": "Confraternização Universal",
  "04-21": "Tiradentes",
  "05-01": "Dia do Trabalho",
  "09-07": "Independência do Brasil",
  "10-12": "Nossa Senhora Aparecida",
  "11-02": "Finados",
  "11-15": "Proclamação da República",
  "11-20": "Dia Nacional de Zumbi e da Consciência Negra",
  "12-25": "Natal",
};

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function somarDias(key: string, dias: number): string {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + dias * 864e5).toISOString().slice(0, 10);
}

/** Nome do feriado nacional na data (YYYY-MM-DD) ou null. */
export function feriadoNacional(key: string): string | null {
  const ano = Number(key.slice(0, 4));
  if (key.slice(5) === "11-20" && ano < 2024) return null;
  const fixo = FIXOS[key.slice(5)];
  if (fixo) return fixo;
  if (key === somarDias(pascoa(ano), -2)) return "Sexta-feira Santa";
  return null;
}
