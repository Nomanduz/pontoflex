// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cnpjValido,
  cpfParcial,
  cpfValido,
  documentoEmpresa,
  empresaEmail,
  funcionarioEmail,
  maskDocumento,
} from "./doc";
import { avaliarCerca, coordenadasValidas, distanciaM } from "./geo";
import { feriadoNacional, pascoa } from "./feriados";
import { montarFolha, TOLERANCIA_DIARIA_MS, type EscalaCfg } from "./escala";
import { criarGuia, type Quadro } from "./face-guia";
import {
  assinarToken,
  conferirSenha,
  gerarCodigoAtivacao,
  hashSenha,
  lerToken,
  normalizarCodigo,
} from "./seguranca.server";

describe("documentos (CPF e CNPJ)", () => {
  it("valida dígitos verificadores", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
  });

  it("empresa pode se cadastrar com CPF ou CNPJ", () => {
    expect(documentoEmpresa("52998224725")).toEqual({ tipo: "CPF", documento: "529.982.247-25" });
    expect(documentoEmpresa("11222333000181")).toEqual({
      tipo: "CNPJ",
      documento: "11.222.333/0001-81",
    });
    expect(() => documentoEmpresa("123")).toThrow("CPF ou CNPJ válido");
  });

  it("máscara de digitação troca de CPF para CNPJ conforme o tamanho", () => {
    expect(maskDocumento("5299822472")).toBe("529.982.247-2");
    expect(maskDocumento("112223330001")).toBe("11.222.333/0001");
  });

  it("CPF parcial não expõe o número inteiro", () => {
    expect(cpfParcial("529.982.247-25")).toBe("***.982.247-**");
  });

  it("logins internos: empresa por documento; funcionário único por empresa", () => {
    expect(empresaEmail("529.982.247-25")).toBe("empresa-52998224725@pontoflex.app");
    const a = funcionarioEmail("aaaaaaaa-0000-0000-0000-000000000000", "529.982.247-25");
    const b = funcionarioEmail("bbbbbbbb-0000-0000-0000-000000000000", "529.982.247-25");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^func-aaaaaaaa0000-52998224725@pontoflex\.app$/);
  });
});

describe("geolocalização", () => {
  it("calcula distância (Praça da Sé → Av. Paulista ≈ 2,5 km)", () => {
    const d = distanciaM(-23.5503, -46.6339, -23.5614, -46.6559);
    expect(d).toBeGreaterThan(2300);
    expect(d).toBeLessThan(2700);
  });

  it("cerca: sem configuração aceita tudo; com raio, recusa longe", () => {
    expect(avaliarCerca({ latitude: null, longitude: null, raio_m: null }, 0, 0)).toEqual({
      distancia_m: null,
      fora: false,
    });
    const cerca = { latitude: -23.5503, longitude: -46.6339, raio_m: 200 };
    expect(avaliarCerca(cerca, -23.5505, -46.634).fora).toBe(false);
    expect(avaliarCerca(cerca, -23.5614, -46.6559).fora).toBe(true);
  });

  it("cerca: desconta a margem de erro do GPS, limitada a 100 m", () => {
    const cerca = { latitude: -23.5503, longitude: -46.6339, raio_m: 50 };
    // ~78 m de distância (caso real do teste em campo)
    const lat = -23.5503 - 78 / 111_320;
    expect(avaliarCerca(cerca, lat, -46.6339).fora).toBe(true);
    expect(avaliarCerca(cerca, lat, -46.6339, 35).fora).toBe(false);
    // precisão absurda não libera marcação a 2,5 km
    expect(avaliarCerca(cerca, -23.5614, -46.6559, 5000).fora).toBe(true);
    expect(avaliarCerca(cerca, lat, -46.6339, Number.NaN).fora).toBe(true);
  });

  it("rejeita coordenadas inválidas ou zeradas", () => {
    expect(coordenadasValidas(-23.5, -46.6)).toBe(true);
    expect(coordenadasValidas(0, 0)).toBe(false);
    expect(coordenadasValidas(91, 0)).toBe(false);
    expect(coordenadasValidas(Number.NaN, 1)).toBe(false);
  });
});

describe("feriados nacionais", () => {
  it("calcula a Páscoa e a Sexta-feira Santa", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    expect(feriadoNacional("2026-04-03")).toBe("Sexta-feira Santa");
  });

  it("inclui datas fixas e a Consciência Negra a partir de 2024", () => {
    expect(feriadoNacional("2026-12-25")).toBe("Natal");
    expect(feriadoNacional("2026-11-20")).toMatch(/Consciência Negra/);
    expect(feriadoNacional("2023-11-20")).toBeNull();
    expect(feriadoNacional("2026-03-10")).toBeNull();
  });
});

describe("folha: feriados e tolerância da CLT", () => {
  const cfg: EscalaCfg = {
    escala: "5x2",
    dias_semana: null,
    escala_inicio: null,
    hora_entrada: "08:00",
    hora_saida_almoco: "12:00",
    hora_retorno_almoco: "13:00",
    hora_saida: "17:00",
  };
  const dia = (d: string, e: string, sa: string, r: string, s: string) => [
    { tipo: "ENTRADA" as const, data_hora: `${d}T${e}:00-03:00` },
    { tipo: "SAIDA_ALMOCO" as const, data_hora: `${d}T${sa}:00-03:00` },
    { tipo: "RETORNO_ALMOCO" as const, data_hora: `${d}T${r}:00-03:00` },
    { tipo: "SAIDA" as const, data_hora: `${d}T${s}:00-03:00` },
  ];
  const agora = new Date("2026-12-31T12:00:00-03:00");

  it("feriado em dia útil não gera falta nem horas previstas", () => {
    const f = montarFolha(cfg, [], "2026-12-25", "2026-12-25", agora);
    expect(f.dias[0]).toMatchObject({
      feriado: "Natal",
      trabalho: false,
      previsto: 0,
      falta: false,
    });
  });

  it("variação de até 10 minutos no dia não conta (art. 58, § 1º)", () => {
    const f = montarFolha(
      cfg,
      dia("2026-12-01", "08:06", "12:00", "13:00", "17:00"),
      "2026-12-01",
      "2026-12-01",
      agora,
    );
    expect(f.dias[0]!.saldo).toBe(0);
    expect(TOLERANCIA_DIARIA_MS).toBe(600_000);
  });

  it("acima de 10 minutos conta integralmente", () => {
    const f = montarFolha(
      cfg,
      dia("2026-12-01", "08:15", "12:00", "13:00", "17:00"),
      "2026-12-01",
      "2026-12-01",
      agora,
    );
    expect(f.dias[0]!.saldo).toBe(-15 * 60_000);
  });
});

describe("guia facial: enquadrar → piscar → capturar", () => {
  const ok = (t: number, olho: number): Quadro => ({
    t,
    rostos: 1,
    cx: 0.5,
    cy: 0.46,
    largura: 0.55,
    desvioNariz: 0,
    piscadaEsq: olho,
    piscadaDir: olho,
  });

  it("orienta o enquadramento", () => {
    const g = criarGuia();
    expect(g.quadro({ t: 0, rostos: 0 })).toBe("sem_rosto");
    expect(g.quadro({ ...ok(0, 0), rostos: 2 })).toBe("varios_rostos");
    expect(g.quadro({ ...ok(0, 0), largura: 0.2 })).toBe("aproxime");
    expect(g.quadro({ ...ok(0, 0), largura: 0.95 })).toBe("afaste");
    expect(g.quadro({ ...ok(0, 0), cx: 0.8 })).toBe("centralize");
    expect(g.quadro({ ...ok(0, 0), desvioNariz: 0.3 })).toBe("olhe_frente");
  });

  it("captura logo após uma piscada completa (abre → fecha → abre)", () => {
    const g = criarGuia();
    expect(g.quadro(ok(0, 0.05))).toBe("segure");
    expect(g.quadro(ok(500, 0.05))).toBe("pisque");
    expect(g.quadro(ok(600, 0.8))).toBe("pisque");
    expect(g.quadro(ok(750, 0.05))).toBe("capturar");
  });

  it("foto com olhos sempre fechados (ou parados) não dispara", () => {
    const g = criarGuia();
    g.quadro(ok(0, 0.9));
    for (let t = 500; t < 5000; t += 100) expect(g.quadro(ok(t, 0.9))).toBe("pisque");
  });

  it("olhos fechados por tempo demais não contam como piscada", () => {
    const g = criarGuia();
    g.quadro(ok(0, 0.05));
    g.quadro(ok(500, 0.05));
    g.quadro(ok(600, 0.8));
    expect(g.quadro(ok(2000, 0.05))).toBe("pisque");
  });

  it("sair do enquadramento durante a piscada recomeça", () => {
    const g = criarGuia();
    g.quadro(ok(0, 0.05));
    g.quadro(ok(500, 0.05));
    g.quadro(ok(600, 0.8));
    expect(g.quadro({ t: 650, rostos: 0 })).toBe("sem_rosto");
    expect(g.quadro(ok(700, 0.05))).toBe("segure");
  });
});

describe("segurança do servidor", () => {
  process.env["APP_SECRET"] = "segredo-de-teste-com-mais-de-32-caracteres!!";

  it("senha mestra com scrypt e sal: hashes diferentes para a mesma senha", () => {
    const a = hashSenha("totem2026");
    expect(a).toMatch(/^scrypt\$/);
    expect(hashSenha("totem2026")).not.toBe(a);
    expect(conferirSenha("totem2026", a)).toBe(true);
    expect(conferirSenha("totem2027", a)).toBe(false);
    expect(conferirSenha("x", null)).toBe(false);
  });

  it("tokens: tipo, validade e assinatura conferidos", () => {
    const t = assinarToken("terminal", { e: "emp" }, 60);
    expect(lerToken("terminal", t)).toMatchObject({ e: "emp" });
    expect(lerToken("confirmar", t)).toBeNull();
    expect(lerToken("terminal", assinarToken("terminal", { e: "emp" }, -1))).toBeNull();
    const [corpo, sig] = t.split(".");
    const outro = Buffer.from(JSON.stringify({ e: "outra", t: "terminal", exp: 9e9 })).toString(
      "base64url",
    );
    expect(lerToken("terminal", `${outro}.${sig}`)).toBeNull();
    expect(lerToken("terminal", `${corpo}`)).toBeNull();
  });

  it("código de ativação legível e normalizável", () => {
    const c = gerarCodigoAtivacao();
    expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(c).not.toMatch(/[01IO]/);
    expect(normalizarCodigo(c.toLowerCase())).toBe(c.replace(/-/g, ""));
  });
});

describe("campos de data e hora no padrão brasileiro", () => {
  it("máscara e conversão de data DD/MM/AAAA", async () => {
    const { mascararData, dataParaIso, isoParaData } = await import("@/components/CampoDataHora");
    expect(mascararData("15112026")).toBe("15/11/2026");
    expect(mascararData("1511")).toBe("15/11");
    expect(dataParaIso("15/11/2026")).toBe("2026-11-15");
    expect(dataParaIso("31/02/2026")).toBe("");
    expect(dataParaIso("15/11")).toBe("");
    expect(isoParaData("2026-11-15")).toBe("15/11/2026");
  });

  it("hora sempre em 24 h", async () => {
    const { mascararHora, horaValida } = await import("@/components/CampoDataHora");
    expect(mascararHora("1345")).toBe("13:45");
    expect(horaValida("13:45")).toBe("13:45");
    expect(horaValida("08:00:00")).toBe("08:00");
    expect(horaValida("24:00")).toBe("");
    expect(horaValida("12:60")).toBe("");
  });
});
