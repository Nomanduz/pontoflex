import { describe, expect, it } from "vitest";
import { avaliarSessao } from "./sessao-politica";

const MIN = 60_000;
const H = 60 * MIN;
const T0 = Date.UTC(2026, 10, 15, 12);

describe("tempo de sessão por perfil", () => {
  it("equipe Nomanduz: sai após 10 min parado ou 8 h logado", () => {
    expect(avaliarSessao("superadmin", T0 + 9 * MIN, T0, T0)).toBe("ok");
    expect(avaliarSessao("superadmin", T0 + 11 * MIN, T0, T0)).toBe("sair");
    expect(avaliarSessao("superadmin", T0 + 8 * H + MIN, T0 + 8 * H, T0)).toBe("sair");
  });

  it("empresa: bloqueia a tela após 15 min parado; sai após 12 h", () => {
    expect(avaliarSessao("admin", T0 + 14 * MIN, T0, T0)).toBe("ok");
    expect(avaliarSessao("admin", T0 + 16 * MIN, T0, T0)).toBe("bloquear");
    expect(avaliarSessao("admin", T0 + 12 * H + MIN, T0 + 12 * H, T0)).toBe("sair");
  });

  it("funcionário: sai após 30 min parado", () => {
    expect(avaliarSessao("funcionario", T0 + 29 * MIN, T0, T0)).toBe("ok");
    expect(avaliarSessao("funcionario", T0 + 31 * MIN, T0, T0)).toBe("sair");
  });

  it("marcas ausentes ou corrompidas encerram a sessão", () => {
    expect(avaliarSessao("admin", T0, Number.NaN, T0)).toBe("sair");
    expect(avaliarSessao("admin", T0, T0, Number.NaN)).toBe("sair");
    expect(avaliarSessao(null, T0, Number.NaN, Number.NaN)).toBe("ok");
  });
});
