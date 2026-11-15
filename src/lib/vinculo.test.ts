import { describe, expect, it } from "vitest";
import { montarFolha, type EscalaCfg } from "./escala";
import {
  diasDeDireito,
  inicioPermitido,
  periodosAquisitivos,
  sugerirFerias,
  validarFerias,
} from "./ferias";
import {
  alertasContrato,
  ausenciasDe,
  diasAvisoPrevio,
  fasesExperiencia,
  somarAnos,
  terminoPrevisto,
  validarContrato,
} from "./vinculo";

const cfg: EscalaCfg = {
  escala: "5x2",
  dias_semana: null,
  escala_inicio: null,
  hora_entrada: "08:00",
  hora_saida_almoco: "12:00",
  hora_retorno_almoco: "13:00",
  hora_saida: "17:00",
};

describe("contratos", () => {
  const exp = {
    data_admissao: "2026-11-02",
    tipo_contrato: "experiencia",
    experiencia_dias: 45,
    experiencia_prorrogacao_dias: 45,
    contrato_fim: null,
  };

  it("experiência 45 + 45: datas de cada fase (admissão conta como 1º dia)", () => {
    expect(fasesExperiencia(exp)).toEqual({ fim1: "2026-12-16", fim2: "2027-01-30" });
    expect(terminoPrevisto(exp)).toBe("2027-01-30");
  });

  it("experiência acima de 90 dias é recusada", () => {
    expect(validarContrato({ ...exp, experiencia_prorrogacao_dias: 60 })).toMatch(/90 dias/);
    expect(validarContrato(exp)).toBeNull();
    expect(validarContrato({ ...exp, data_admissao: null })).toMatch(/admissão/);
  });

  it("prazo determinado: até 2 anos; aprendiz: até 3", () => {
    const det = { ...exp, tipo_contrato: "determinado", contrato_fim: "2029-01-01" };
    expect(validarContrato(det)).toMatch(/2 anos/);
    expect(validarContrato({ ...det, tipo_contrato: "aprendiz" })).toBeNull();
    expect(validarContrato({ ...det, contrato_fim: null })).toMatch(/término/);
  });

  it("avisa 15 dias antes e quando a experiência já venceu", () => {
    const so45 = { ...exp, experiencia_prorrogacao_dias: null };
    expect(alertasContrato(so45, "2026-11-20")).toHaveLength(0);
    const perto = alertasContrato(so45, "2026-12-10");
    expect(perto[0]?.texto).toMatch(/termina em 6 dia/);
    expect(perto[0]?.texto).toMatch(/prorrogar/);
    expect(alertasContrato(so45, "2026-12-20")[0]?.nivel).toBe("urgente");
    expect(
      alertasContrato({ ...so45, data_desligamento: "2026-12-16" }, "2026-12-20"),
    ).toHaveLength(0);
  });

  it("aviso prévio proporcional: 30 + 3 por ano, até 90", () => {
    expect(diasAvisoPrevio("2020-03-10", "2026-03-09")).toBe(45);
    expect(diasAvisoPrevio("2020-03-10", "2026-03-10")).toBe(48);
    expect(diasAvisoPrevio("1990-01-01", "2026-01-01")).toBe(90);
  });

  it("29/02 + 1 ano vira 28/02", () => {
    expect(somarAnos("2024-02-29", 1)).toBe("2025-02-28");
  });
});

describe("férias", () => {
  it("dias de direito pelas faltas (CLT art. 130)", () => {
    expect([0, 5, 6, 14, 15, 23, 24, 32, 33].map(diasDeDireito)).toEqual([
      30, 30, 24, 24, 18, 18, 12, 12, 0,
    ]);
  });

  it("períodos aquisitivos, prazo de concessão e situação", () => {
    const ps = periodosAquisitivos({ admissao: "2024-03-10", hoje: "2026-01-15", lancadas: [] });
    expect(ps.map((p) => [p.inicio, p.fim, p.limiteConcessao, p.situacao])).toEqual([
      ["2024-03-10", "2025-03-09", "2026-03-09", "vencendo"],
      ["2025-03-10", "2026-03-09", "2027-03-09", "em_aquisicao"],
    ]);
    const vencido = periodosAquisitivos({
      admissao: "2024-03-10",
      hoje: "2026-04-01",
      lancadas: [],
    });
    expect(vencido[0]?.situacao).toBe("vencido");
    const quitado = periodosAquisitivos({
      admissao: "2024-03-10",
      hoje: "2026-04-01",
      lancadas: [
        { aquisitivo_inicio: "2024-03-10", inicio: "2025-06-02", dias: 20, abono_dias: 10 },
      ],
    });
    expect(quitado[0]?.situacao).toBe("quitado");
  });

  it("não começa em folga/feriado nem 2 dias antes deles", () => {
    expect(inicioPermitido(cfg, "2026-11-16")).toBe(true); // segunda
    expect(inicioPermitido(cfg, "2026-11-19")).toBe(false); // quinta: sáb em 2 dias
    expect(inicioPermitido(cfg, "2026-11-21")).toBe(false); // sábado
    expect(inicioPermitido(cfg, "2026-12-23")).toBe(false); // véspera de Natal - 2
  });

  it("sugestão respeita 30 dias de aviso e o início permitido", () => {
    const ps = periodosAquisitivos({ admissao: "2024-03-10", hoje: "2026-01-15", lancadas: [] });
    const s = sugerirFerias(ps, cfg, "2026-01-15")!;
    expect(s.periodo.inicio).toBe("2024-03-10");
    expect(s.inicio).toBe("2026-02-16"); // primeira segunda após hoje + 30 dias
    expect(inicioPermitido(cfg, s.inicio)).toBe(true);
    expect(s.dias).toBe(30);
    // 30 dias a partir de 16/02 passam do limite de 09/03: a sugestão avisa
    expect(s.urgente).toBe(true);
  });

  it("fracionamento: até 3 períodos, um com 14+ dias, demais com 5+", () => {
    const [p] = periodosAquisitivos({ admissao: "2024-03-10", hoje: "2026-01-15", lancadas: [] });
    const base = { cfg, hoje: "2026-01-15", periodo: p! };
    const ok = validarFerias({
      ...base,
      nova: { aquisitivo_inicio: p!.inicio, inicio: "2026-03-02", dias: 14, abono_dias: 0 },
      outras: [],
    });
    expect(ok.erros).toEqual([]);
    const curto = validarFerias({
      ...base,
      nova: { aquisitivo_inicio: p!.inicio, inicio: "2026-03-02", dias: 4, abono_dias: 0 },
      outras: [],
    });
    expect(curto.erros.join()).toMatch(/5 dias/);
    const semQuatorze = validarFerias({
      ...base,
      nova: { aquisitivo_inicio: p!.inicio, inicio: "2026-03-02", dias: 10, abono_dias: 0 },
      outras: [
        { aquisitivo_inicio: p!.inicio, inicio: "2026-02-02", dias: 10, abono_dias: 0 },
        { aquisitivo_inicio: p!.inicio, inicio: "2026-02-16", dias: 5, abono_dias: 0 },
      ],
    });
    expect(semQuatorze.erros.join()).toMatch(/14 dias/);
    const abonoDemais = validarFerias({
      ...base,
      nova: { aquisitivo_inicio: p!.inicio, inicio: "2026-03-02", dias: 19, abono_dias: 11 },
      outras: [],
    });
    expect(abonoDemais.erros.join()).toMatch(/1\/3/);
  });

  it("avisa sobre pagamento em dobro e aviso de 30 dias", () => {
    const [p] = periodosAquisitivos({ admissao: "2024-03-10", hoje: "2026-02-20", lancadas: [] });
    const r = validarFerias({
      cfg,
      hoje: "2026-02-20",
      periodo: p!,
      nova: { aquisitivo_inicio: p!.inicio, inicio: "2026-03-02", dias: 30, abono_dias: 0 },
      outras: [],
    });
    expect(r.avisos.join()).toMatch(/30 dias de antecedência/);
    expect(r.avisos.join()).toMatch(/dobro/);
  });
});

describe("espelho de ponto com férias e afastamentos", () => {
  it("dias justificados não viram falta; antes da admissão também não", () => {
    const aus = ausenciasDe(
      [{ tipo: "atestado", inicio: "2026-11-04", fim: "2026-11-05" }],
      [{ inicio: "2026-11-09", dias: 5 }],
    );
    const folha = montarFolha(
      cfg,
      [],
      "2026-11-02",
      "2026-11-13",
      new Date("2026-11-20T12:00:00Z"),
      {
        ausencias: aus,
        admissao: "2026-11-03",
      },
    );
    const dia = (k: string) => folha.dias.find((d) => d.dia === k)!;
    expect(dia("2026-11-02").ausencia).toBe("Antes da admissão");
    expect(dia("2026-11-02").falta).toBe(false);
    expect(dia("2026-11-04").ausencia).toBe("Atestado médico");
    expect(dia("2026-11-10").ausencia).toBe("Férias");
    expect(dia("2026-11-03").falta).toBe(true);
    // 02 a 13/11: dias úteis 02,03,04,05,06,09,10,11,12,13 → só 03 e 06 são faltas
    expect(folha.totais.faltas).toBe(2);
    expect(folha.totais.ausencias).toBe(7); // 2 de atestado + 5 de férias (09 a 13)
  });
});
