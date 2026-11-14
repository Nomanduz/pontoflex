import { describe, expect, it } from "vitest";
import { nextTipo, presenca, saldoDia, workedMs, type Marcacao } from "./ponto";
import { empresaEmail, funcionarioEmail, maskCnpj, maskCpf } from "./doc";

const at = (h: string) => `2026-10-14T${h}:00-03:00`;

describe("sequência de marcações", () => {
  it("começa com ENTRADA", () => expect(nextTipo([])).toBe("ENTRADA"));
  it("segue entrada → saída almoço → retorno → saída", () => {
    const d: Marcacao[] = [{ tipo: "ENTRADA", data_hora: at("08:00") }];
    expect(nextTipo(d, new Date(at("09:00")))).toBe("SAIDA_ALMOCO");
    d.push({ tipo: "SAIDA_ALMOCO", data_hora: at("12:00") });
    expect(nextTipo(d, new Date(at("12:30")))).toBe("RETORNO_ALMOCO");
    d.push({ tipo: "RETORNO_ALMOCO", data_hora: at("13:00") });
    expect(nextTipo(d, new Date(at("14:00")))).toBe("SAIDA");
  });
  it("encerra o dia após SAIDA", () => {
    expect(
      nextTipo(
        [
          { tipo: "ENTRADA", data_hora: at("08:00") },
          { tipo: "SAIDA_ALMOCO", data_hora: at("12:00") },
          { tipo: "RETORNO_ALMOCO", data_hora: at("13:00") },
          { tipo: "SAIDA", data_hora: at("17:00") },
        ],
        new Date(at("17:30")),
      ),
    ).toBeNull();
  });
});

describe("horas trabalhadas", () => {
  it("jornada padrão 08-12 / 13-17 soma 8h", () => {
    const ms = workedMs([
      { tipo: "ENTRADA", data_hora: at("08:00") },
      { tipo: "SAIDA_ALMOCO", data_hora: at("12:00") },
      { tipo: "RETORNO_ALMOCO", data_hora: at("13:00") },
      { tipo: "SAIDA", data_hora: at("17:00") },
    ]);
    expect(ms).toBe(8 * 3600_000);
  });
  it("período aberto conta até agora", () => {
    const ms = workedMs([{ tipo: "ENTRADA", data_hora: at("08:00") }], new Date(at("10:30")));
    expect(ms).toBe(2.5 * 3600_000);
  });
  it("saldo em dia útil desconta 8h", () => {
    // 2026-10-14 is a Wednesday
    expect(
      saldoDia("2026-10-14", [{ tipo: "ENTRADA", data_hora: at("08:00") }], new Date(at("14:00"))),
    ).toBe(-2 * 3600_000);
  });
});

describe("presentes e ausentes", () => {
  it("presente tem ENTRADA hoje; inativo não conta como ausente", () => {
    const r = presenca(
      [
        { id: "a", ativo: true },
        { id: "b", ativo: true },
        { id: "c", ativo: false },
      ],
      [{ funcionario_id: "a", tipo: "ENTRADA" }],
    );
    expect(r).toEqual({ total: 3, presentes: 1, ausentes: 1 });
  });
});

describe("documentos", () => {
  it("formata CNPJ e CPF", () => {
    expect(maskCnpj("12345678000199")).toBe("12.345.678/0001-99");
    expect(maskCpf("12345678910")).toBe("123.456.789-10");
  });
  it("gera login interno a partir dos dígitos", () => {
    expect(empresaEmail("12.345.678/0001-99")).toBe("empresa-12345678000199@pontoflex.app");
    expect(funcionarioEmail("abcdef12-3456-7890-abcd-ef1234567890", "123.456.789-10")).toBe(
      "func-abcdef123456-12345678910@pontoflex.app",
    );
  });
});
