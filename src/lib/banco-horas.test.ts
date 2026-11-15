import { describe, expect, it } from "vitest";
import {
  calcularBanco,
  formatarMinutos,
  lerHoras,
  movimentosDasFolhas,
  type Movimento,
} from "./banco-horas";

const mov = (data: string, minutos: number, origem: Movimento["origem"] = "folha"): Movimento => ({
  data,
  minutos,
  origem,
  descricao: "",
});

describe("banco de horas", () => {
  it("soma folhas e lançamentos e mostra o saldo após cada movimento", () => {
    const b = calcularBanco(
      [mov("2026-01-20", 300), mov("2026-02-20", -60), mov("2026-02-25", -120, "folga")],
      6,
      "2026-03-01",
    );
    expect(b.saldo).toBe(120);
    expect(b.extrato.map((l) => l.saldo)).toEqual([120, 240, 300]); // mais recente primeiro
  });

  it("usa primeiro as horas mais antigas e aponta as que passaram de 6 meses", () => {
    const b = calcularBanco(
      [mov("2026-01-20", 300), mov("2026-05-20", 120), mov("2026-06-01", -200, "folga")],
      6,
      "2026-08-01",
    );
    // 200 min de folga consomem os 300 de janeiro: sobram 100 de janeiro (vencem 20/07) e 120 de maio
    expect(b.vencidas).toBe(100);
    expect(b.aVencer).toEqual([{ venceEm: "2026-11-20", minutos: 120 }]);
  });

  it("saldo negativo é quitado pelas próximas horas a mais", () => {
    const b = calcularBanco([mov("2026-01-20", -90), mov("2026-02-20", 150)], 6, "2026-03-01");
    expect(b.saldo).toBe(60);
    expect(b.aVencer).toEqual([{ venceEm: "2026-08-20", minutos: 60 }]);
  });

  it("sem prazo (banco desativado) nada vence", () => {
    const b = calcularBanco([mov("2020-01-20", 300)], 0, "2026-03-01");
    expect(b.vencidas).toBe(0);
    expect(b.aVencer).toEqual([]);
  });

  it("saldo da folha fechada vira minutos", () => {
    const [m] = movimentosDasFolhas([
      {
        periodo_inicio: "2026-10-21",
        periodo_fim: "2026-11-20",
        resumo: { folha: { totais: { saldo: 5_400_000 } } },
      },
    ]);
    expect(m).toMatchObject({ data: "2026-11-20", minutos: 90, origem: "folha" });
  });

  it("formata e lê horas", () => {
    expect(formatarMinutos(150)).toBe("+2h30");
    expect(formatarMinutos(-45)).toBe("-0h45");
    expect(lerHoras("2:30")).toBe(150);
    expect(lerHoras("2h30")).toBe(150);
    expect(lerHoras("8")).toBe(480);
    expect(lerHoras("abc")).toBeNull();
  });
});
