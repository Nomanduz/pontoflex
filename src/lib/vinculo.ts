/**
 * Vínculo de trabalho: contratos, afastamentos e desligamento (regras da CLT usadas pelo app).
 * Funções puras: datas no formato AAAA-MM-DD.
 */

export const somarDias = (key: string, n: number) => {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
/** Mesmo dia N anos depois (29/02 vira 28/02 em ano não bissexto). */
export function somarAnos(key: string, n: number) {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y + n, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
}

// ---------- Contratos ----------
export const TIPOS_CONTRATO = {
  experiencia: "Contrato de experiência",
  indeterminado: "Prazo indeterminado (efetivo)",
  determinado: "Prazo determinado (temporário)",
  estagio: "Estágio",
  aprendiz: "Jovem aprendiz",
} as const;
export type TipoContrato = keyof typeof TIPOS_CONTRATO;

export interface Contrato {
  data_admissao: string | null;
  tipo_contrato: string;
  experiencia_dias: number | null;
  experiencia_prorrogacao_dias: number | null;
  contrato_fim: string | null;
  data_desligamento?: string | null;
}

/** Último dia de cada fase da experiência (o dia da admissão conta como 1º dia). */
export function fasesExperiencia(c: Contrato): { fim1: string; fim2: string | null } | null {
  if (c.tipo_contrato !== "experiencia" || !c.data_admissao || !c.experiencia_dias) return null;
  const fim1 = somarDias(c.data_admissao, c.experiencia_dias - 1);
  const fim2 = c.experiencia_prorrogacao_dias
    ? somarDias(fim1, c.experiencia_prorrogacao_dias)
    : null;
  return { fim1, fim2 };
}

/** Data em que o contrato termina sozinho (experiência, temporário, estágio, aprendiz). */
export function terminoPrevisto(c: Contrato): string | null {
  const fases = fasesExperiencia(c);
  if (fases) return fases.fim2 ?? fases.fim1;
  return c.tipo_contrato === "indeterminado" ? null : c.contrato_fim;
}

export function validarContrato(c: Contrato): string | null {
  if (!c.data_admissao) return "Informe a data de admissão";
  if (c.tipo_contrato === "experiencia") {
    const a = c.experiencia_dias ?? 0;
    const b = c.experiencia_prorrogacao_dias ?? 0;
    if (a < 1) return "Informe os dias do contrato de experiência";
    if (a + b > 90)
      return "A experiência não pode passar de 90 dias somando a prorrogação (CLT art. 445)";
  }
  if (["determinado", "estagio", "aprendiz"].includes(c.tipo_contrato)) {
    if (!c.contrato_fim) return "Informe a data prevista de término do contrato";
    if (c.contrato_fim < c.data_admissao) return "O término não pode ser antes da admissão";
    const limiteAnos =
      c.tipo_contrato === "determinado" ? 2 : c.tipo_contrato === "estagio" ? 2 : 3;
    if (c.contrato_fim > somarAnos(c.data_admissao, limiteAnos))
      return c.tipo_contrato === "determinado"
        ? "Contrato por prazo determinado: máximo de 2 anos (CLT art. 445)"
        : c.tipo_contrato === "estagio"
          ? "Estágio: máximo de 2 anos na mesma empresa (Lei 11.788, art. 11)"
          : "Aprendizagem: máximo de 3 anos (CLT art. 428, § 3º)";
  }
  return null;
}

export type Alerta = { nivel: "info" | "atencao" | "urgente"; texto: string };

/** Avisos de contrato: fim da experiência / do contrato nos próximos 15 dias. */
export function alertasContrato(c: Contrato, hoje: string): Alerta[] {
  if (c.data_desligamento) return [];
  const out: Alerta[] = [];
  const fases = fasesExperiencia(c);
  const avisar = (data: string, oque: string) => {
    const d = diasEntre(hoje, data);
    if (d < 0)
      out.push({
        nivel: "urgente",
        texto: `${oque} venceu há ${-d} dia(s). Se a pessoa continua trabalhando, o contrato já virou prazo indeterminado: atualize o cadastro.`,
      });
    else if (d <= 15)
      out.push({
        nivel: d <= 5 ? "urgente" : "atencao",
        texto: `${oque} termina ${d === 0 ? "hoje" : `em ${d} dia(s)`}. Decida: ${
          fases && !c.experiencia_prorrogacao_dias
            ? "prorrogar, efetivar ou encerrar"
            : "efetivar ou encerrar"
        }.`,
      });
  };
  if (fases) {
    if (fases.fim2) avisar(fases.fim2, "A prorrogação da experiência");
    else avisar(fases.fim1, "O contrato de experiência");
  } else if (c.tipo_contrato !== "indeterminado" && c.contrato_fim) {
    avisar(
      c.contrato_fim,
      `O contrato (${TIPOS_CONTRATO[c.tipo_contrato as TipoContrato] ?? c.tipo_contrato})`,
    );
  }
  return out;
}

// ---------- Afastamentos ----------
export const TIPOS_AFASTAMENTO = {
  atestado: "Atestado médico",
  auxilio_doenca: "Auxílio por incapacidade (INSS)",
  acidente_trabalho: "Acidente de trabalho",
  licenca_maternidade: "Licença-maternidade",
  licenca_paternidade: "Licença-paternidade",
  casamento: "Casamento (gala)",
  falecimento_familiar: "Falecimento de familiar (nojo)",
  doacao_sangue: "Doação de sangue",
  servico_militar: "Serviço militar",
  justica_eleitoral: "Justiça eleitoral / júri",
  suspensao: "Suspensão disciplinar",
  licenca_nao_remunerada: "Licença não remunerada",
  outro: "Outro",
} as const;
export type TipoAfastamento = keyof typeof TIPOS_AFASTAMENTO;

/** Dias sugeridos pela lei, para preencher o término automaticamente. */
export const DIAS_PADRAO_AFASTAMENTO: Partial<Record<TipoAfastamento, number>> = {
  licenca_maternidade: 120, // CLT art. 392
  licenca_paternidade: 5, // ADCT art. 10, § 1º
  casamento: 3, // CLT art. 473, II
  falecimento_familiar: 2, // CLT art. 473, I
  doacao_sangue: 1, // CLT art. 473, IV
};

/** Faltas que contam contra as férias (CLT art. 130): suspensão e licença não remunerada. */
export const AFASTAMENTO_INJUSTIFICADO: TipoAfastamento[] = ["suspensao", "licenca_nao_remunerada"];

// ---------- Desligamento ----------
export const MOTIVOS_DESLIGAMENTO = {
  sem_justa_causa: "Dispensa sem justa causa",
  justa_causa: "Dispensa por justa causa",
  pedido_demissao: "Pedido de demissão",
  fim_experiencia: "Término do contrato de experiência",
  fim_contrato: "Término do contrato por prazo determinado",
  acordo: "Acordo entre as partes (CLT art. 484-A)",
  aposentadoria: "Aposentadoria",
  falecimento: "Falecimento",
  outro: "Outro",
} as const;
export type MotivoDesligamento = keyof typeof MOTIVOS_DESLIGAMENTO;

export const AVISOS_PREVIOS = {
  trabalhado: "Trabalhado",
  indenizado: "Indenizado",
  dispensado: "Dispensado",
  nao_se_aplica: "Não se aplica",
} as const;
export type AvisoPrevio = keyof typeof AVISOS_PREVIOS;

/** Aviso prévio proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, até 90. */
export function diasAvisoPrevio(admissao: string, desligamento: string): number {
  let anos = 0;
  while (somarAnos(admissao, anos + 1) <= desligamento) anos++;
  return Math.min(30 + 3 * anos, 90);
}

// ---------- Ausências no espelho de ponto ----------
export interface Ausencia {
  inicio: string;
  fim: string;
  rotulo: string;
}

/** Converte férias e afastamentos do banco nos dias justificados do espelho de ponto. */
export function ausenciasDe(
  afastamentos: { tipo: string; inicio: string; fim: string }[],
  ferias: { inicio: string; dias: number }[],
): Ausencia[] {
  return [
    ...ferias.map((f) => ({
      inicio: f.inicio,
      fim: somarDias(f.inicio, f.dias - 1),
      rotulo: "Férias",
    })),
    ...afastamentos.map((a) => ({
      inicio: a.inicio,
      fim: a.fim,
      rotulo: TIPOS_AFASTAMENTO[a.tipo as TipoAfastamento] ?? "Afastamento",
    })),
  ];
}
