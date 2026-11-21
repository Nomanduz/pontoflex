import { describe, expect, it } from "vitest";
import { podeTrocarSenha, validarNovaSenha } from "./senha";

describe("troca de senha do funcionário", () => {
  it("permite a primeira troca", () => expect(podeTrocarSenha(null)).toBe(true));
  it("bloqueia segunda troca no mesmo mês", () =>
    expect(podeTrocarSenha("2026-11-02T15:00:00Z", new Date("2026-11-28T15:00:00Z"))).toBe(false));
  it("libera no mês seguinte", () =>
    expect(podeTrocarSenha("2026-11-30T15:00:00Z", new Date("2026-12-01T15:00:00Z"))).toBe(true));
  it("exige 8 caracteres com letras e números", () => {
    expect(validarNovaSenha("abc12")).not.toBeNull();
    expect(validarNovaSenha("abcdefgh")).not.toBeNull();
    expect(validarNovaSenha("abcd1234")).toBeNull();
  });
});

describe("senha da empresa", () => {
  it("8+ caracteres com letras e números; aceita senhas longas do navegador", async () => {
    const { validarSenhaEmpresa } = await import("./cadastro.functions");
    expect(validarSenhaEmpresa("nomanduz25")).toBeNull();
    expect(validarSenhaEmpresa("abc12345")).toBeNull();
    expect(validarSenhaEmpresa("Xq7-mP9k-Ls2v-Wd4h")).toBeNull(); // formato sugerido pelo Chrome
    expect(validarSenhaEmpresa("abc1234")).toMatch(/8 caracteres/);
    expect(validarSenhaEmpresa("somenteletras")).toMatch(/letras e números/);
    expect(validarSenhaEmpresa("12345678")).toMatch(/letras e números/);
    expect(validarSenhaEmpresa("a1".repeat(37))).toMatch(/72/);
  });
});
