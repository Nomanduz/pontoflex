/**
 * Férias (CLT arts. 129 a 145): períodos aquisitivos, dias de direito, prazo para conceder,
 * sugestão de data e conferência das regras de fracionamento.
 */
import { feriadoNacional } from "./feriados";
import { isDiaTrabalho, type EscalaCfg } from "./escala";
import { diasEntre, somarAnos, somarDias, type Alerta } from "./vinculo";

export interface FeriasLancada {
  id?: string;
  aquisitivo_inicio: string;
  inicio: string;
  dias: number;
  abono_dias: number;
}

/** CLT art. 130: dias de férias conforme as faltas injustificadas no período aquisitivo. */
export function diasDeDireito(faltas: number): number {
  if (faltas <= 5) return 30;
  if (faltas <= 14) return 24;
  if (faltas <= 23) return 18;
  if (faltas <= 32) return 12;
  return 0;
}

export type SituacaoPeriodo = "em_aquisicao" | "a_programar" | "vencendo" | "vencido" | "quitado";

export interface PeriodoAquisitivo {
  numero: number;
  inicio: string;
  fim: string;
  /** Último dia para a empresa conceder sem pagar em dobro (CLT art. 134 e 137). */
  limiteConcessao: string;
  direito: number;
  usados: number;
  saldo: number;
  situacao: SituacaoPeriodo;
}

export function periodosAquisitivos(p: {
  admissao: string;
  hoje: string;
  desligamento?: string | null;
  lancadas: FeriasLancada[];
  /** Faltas injustificadas por período (chave = início do período). */
  faltas?: Record<string, number>;
}): PeriodoAquisitivo[] {
  const out: PeriodoAquisitivo[] = [];
  const ate = p.desligamento && p.desligamento < p.hoje ? p.desligamento : p.hoje;
  for (let n = 0; ; n++) {
    const inicio = somarAnos(p.admissao, n);
    if (inicio > ate) break;
    const fim = somarDias(somarAnos(p.admissao, n + 1), -1);
    const limiteConcessao = somarDias(somarAnos(p.admissao, n + 2), -1);
    const direito = diasDeDireito(p.faltas?.[inicio] ?? 0);
    const usados = p.lancadas
      .filter((f) => f.aquisitivo_inicio === inicio)
      .reduce((s, f) => s + f.dias + f.abono_dias, 0);
    const saldo = Math.max(direito - usados, 0);
    let situacao: SituacaoPeriodo;
    if (fim >= p.hoje) situacao = "em_aquisicao";
    else if (saldo === 0) situacao = "quitado";
    else if (limiteConcessao < p.hoje) situacao = "vencido";
    else if (diasEntre(p.hoje, limiteConcessao) <= 90) situacao = "vencendo";
    else situacao = "a_programar";
    out.push({ numero: n + 1, inicio, fim, limiteConcessao, direito, usados, saldo, situacao });
  }
  return out;
}

/**
 * CLT art. 134, § 3º: as férias não podem começar nos 2 dias que antecedem feriado ou o
 * descanso semanal remunerado.
 */
export function inicioPermitido(cfg: EscalaCfg, dia: string): boolean {
  if (feriadoNacional(dia) || !isDiaTrabalho(cfg, dia)) return false;
  for (const k of [1, 2]) {
    const d = somarDias(dia, k);
    if (feriadoNacional(d) || !isDiaTrabalho(cfg, d)) return false;
  }
  return true;
}

/** Primeira data válida a partir de "desde". */
export function proximoInicioPermitido(cfg: EscalaCfg, desde: string): string | null {
  for (let i = 0; i < 60; i++) {
    const d = somarDias(desde, i);
    if (inicioPermitido(cfg, d)) return d;
  }
  return null;
}

export interface Sugestao {
  periodo: PeriodoAquisitivo;
  inicio: string;
  dias: number;
  fim: string;
  /** Data limite para avisar o funcionário (30 dias antes, CLT art. 135). */
  avisarAte: string;
  urgente: boolean;
}

/**
 * Sugere as próximas férias: período mais antigo com saldo, começando assim que possível
 * respeitando o aviso de 30 dias e a regra do início (art. 134, § 3º).
 */
export function sugerirFerias(
  periodos: PeriodoAquisitivo[],
  cfg: EscalaCfg,
  hoje: string,
): Sugestao | null {
  const alvo = periodos.find((p) => p.situacao !== "em_aquisicao" && p.saldo > 0);
  const proximo = periodos.find((p) => p.situacao === "em_aquisicao");
  const periodo = alvo ?? proximo;
  if (!periodo || periodo.saldo === 0) return null;
  const desde = [somarDias(hoje, 30), somarDias(periodo.fim, 1)].sort().at(-1)!;
  const inicio = proximoInicioPermitido(cfg, desde);
  if (!inicio) return null;
  const dias = periodo.saldo;
  const fim = somarDias(inicio, dias - 1);
  return {
    periodo,
    inicio,
    dias,
    fim,
    avisarAte: somarDias(inicio, -30),
    urgente: fim > periodo.limiteConcessao,
  };
}

/** Confere uma nova programação de férias contra as regras da CLT. Devolve erros e avisos. */
export function validarFerias(p: {
  nova: FeriasLancada;
  periodo: PeriodoAquisitivo;
  outras: FeriasLancada[];
  cfg: EscalaCfg;
  hoje: string;
}): { erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  const { nova, periodo, cfg } = p;
  const mesmas = p.outras.filter(
    (f) => f.aquisitivo_inicio === periodo.inicio && (nova.id == null || f.id !== nova.id),
  );
  const todas = [...mesmas, nova];

  if (nova.dias < 5)
    erros.push("Cada período de férias precisa ter pelo menos 5 dias (CLT art. 134, § 1º).");
  if (todas.length > 3)
    erros.push("As férias podem ser divididas em no máximo 3 períodos (CLT art. 134, § 1º).");
  const usados = todas.reduce((s, f) => s + f.dias + f.abono_dias, 0);
  if (usados > periodo.direito)
    erros.push(
      `O total (${usados} dias, com abono) passa do direito deste período (${periodo.direito} dias).`,
    );
  const abono = todas.reduce((s, f) => s + f.abono_dias, 0);
  if (abono > Math.floor(periodo.direito / 3))
    erros.push("O abono pecuniário é de no máximo 1/3 das férias (CLT art. 143).");
  // Se dividir, um dos períodos precisa ter 14 dias ou mais.
  const restante = periodo.direito - usados;
  const algum14 = todas.some((f) => f.dias >= 14);
  if (todas.length > 1 && !algum14 && restante < 14)
    erros.push(
      "Ao dividir as férias, um dos períodos precisa ter pelo menos 14 dias (CLT art. 134, § 1º).",
    );
  if (todas.length === 3 && !algum14)
    erros.push("Ao dividir em 3 períodos, um deles precisa ter pelo menos 14 dias.");
  if (nova.inicio <= periodo.fim)
    erros.push(
      `As férias deste período só podem começar depois de ${formatar(periodo.fim)}, quando ele se completa.`,
    );
  if (!inicioPermitido(cfg, nova.inicio))
    erros.push(
      "As férias não podem começar em folga/feriado nem nos 2 dias antes de folga ou feriado (CLT art. 134, § 3º).",
    );
  const fim = somarDias(nova.inicio, nova.dias - 1);
  for (const f of mesmas) {
    const fFim = somarDias(f.inicio, f.dias - 1);
    if (nova.inicio <= fFim && fim >= f.inicio)
      erros.push("Este período se sobrepõe a outras férias já programadas.");
  }
  if (diasEntre(p.hoje, nova.inicio) < 30)
    avisos.push(
      "Faltam menos de 30 dias: o aviso de férias deve ser dado com 30 dias de antecedência (CLT art. 135).",
    );
  if (fim > periodo.limiteConcessao)
    avisos.push(
      `Termina depois de ${formatar(periodo.limiteConcessao)}: os dias após o prazo são pagos em dobro (CLT art. 137).`,
    );
  return { erros, avisos };
}

export function alertasFerias(periodos: PeriodoAquisitivo[]): Alerta[] {
  const out: Alerta[] = [];
  for (const p of periodos) {
    if (p.situacao === "vencido")
      out.push({
        nivel: "urgente",
        texto: `Férias do período ${formatar(p.inicio)} a ${formatar(p.fim)} vencidas (${p.saldo} dias): devidas em dobro.`,
      });
    else if (p.situacao === "vencendo")
      out.push({
        nivel: "atencao",
        texto: `Programe ${p.saldo} dias de férias até ${formatar(p.limiteConcessao)} para não pagar em dobro.`,
      });
  }
  return out;
}

export const SITUACAO_LABEL: Record<SituacaoPeriodo, string> = {
  em_aquisicao: "Em aquisição",
  a_programar: "A programar",
  vencendo: "Programar logo",
  vencido: "Vencido",
  quitado: "Concedido",
};

const formatar = (k: string) => k.split("-").reverse().join("/");
