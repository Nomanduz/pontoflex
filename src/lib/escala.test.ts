import { describe, expect, it } from "vitest";
import { isDiaTrabalho, montarFolha, periodoDe, previstoMs, type EscalaCfg } from "./escala";
import { nextTipo } from "./ponto";

const cfg = (escala: string, extra: Partial<EscalaCfg> = {}): EscalaCfg => ({
  escala, dias_semana: null, escala_inicio: null,
  hora_entrada: "08:00:00", hora_saida_almoco: "12:00:00", hora_retorno_almoco: "13:00:00", hora_saida: "17:00:00", ...extra,
});

describe("período de fechamento (21 a 20)", () => {
  it("dia 15 de outubro fica no período 21/09 a 20/10", () => expect(periodoDe("2026-10-15")).toEqual({ inicio: "2026-09-21", fim: "2026-10-20" }));
  it("dia 21 de outubro abre o período 21/10 a 20/11", () => expect(periodoDe("2026-10-21")).toEqual({ inicio: "2026-10-21", fim: "2026-11-20" }));
  it("virada de ano: 05/01 fica em 21/12 a 20/01", () => expect(periodoDe("2027-01-05")).toEqual({ inicio: "2026-12-21", fim: "2027-01-20" }));
});

describe("escalas", () => {
  // 2026-10-17 is Saturday, 2026-10-18 Sunday
  it("5x2 folga sábado e domingo", () => {
    expect(isDiaTrabalho(cfg("5x2"), "2026-10-16")).toBe(true);
    expect(isDiaTrabalho(cfg("5x2"), "2026-10-17")).toBe(false);
  });
  it("6x1 trabalha sábado e folga domingo", () => {
    expect(isDiaTrabalho(cfg("6x1"), "2026-10-17")).toBe(true);
    expect(isDiaTrabalho(cfg("6x1"), "2026-10-18")).toBe(false);
  });
  it("4x3 folga sexta", () => expect(isDiaTrabalho(cfg("4x3"), "2026-10-16")).toBe(false));
  it("12x36 alterna dias a partir do início", () => {
    const c = cfg("12x36", { escala_inicio: "2026-10-01" });
    expect(["2026-10-01", "2026-10-02", "2026-10-03"].map((d) => isDiaTrabalho(c, d))).toEqual([true, false, true]);
  });
  it("24x48 trabalha 1 dia a cada 3", () => {
    const c = cfg("24x48", { escala_inicio: "2026-10-01" });
    expect(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((d) => isDiaTrabalho(c, d))).toEqual([true, false, false, true]);
  });
  it("jornada 08-12/13-17 prevê 8h", () => expect(previstoMs(cfg("5x2"))).toBe(8 * 3600_000));
  it("plantão noturno 19h-07h com 1h de intervalo prevê 11h", () =>
    expect(previstoMs(cfg("12x36", { hora_entrada: "19:00", hora_saida_almoco: "23:00", hora_retorno_almoco: "00:00", hora_saida: "07:00" }))).toBe(11 * 3600_000));
});

describe("jornada que cruza a meia-noite", () => {
  it("após ENTRADA às 19h, SAIDA_ALMOCO é aceita na madrugada", () =>
    expect(nextTipo([{ tipo: "ENTRADA", data_hora: "2026-10-14T19:00:00-03:00" }], new Date("2026-10-15T01:00:00-03:00"))).toBe("SAIDA_ALMOCO"));
});

describe("folha do período", () => {
  it("dia útil sem marcação conta como falta", () => {
    const f = montarFolha(cfg("5x2"), [], "2026-09-21", "2026-10-20", new Date("2026-10-25T12:00:00-03:00"));
    expect(f.totais.faltas).toBe(22);
    expect(f.totais.saldo).toBe(-22 * 8 * 3600_000);
  });
});
