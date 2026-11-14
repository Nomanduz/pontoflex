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
