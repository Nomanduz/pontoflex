// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- mocks de teste */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeSupabase } from "@/test/fake-supabase";

process.env["APP_SECRET"] = "segredo-de-teste-com-mais-de-32-caracteres!!";

const mocks = vi.hoisted(() => ({
  admin: null as any,
  buscarRosto: vi.fn(),
  senhaConfere: vi.fn(),
  entrarComSenha: vi.fn(),
}));

// createServerFn de teste: executa o validador e depois o handler, como o TanStack Start faz.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validar: ((d: unknown) => unknown) | undefined;
    const b: any = {
      middleware: () => b,
      validator: (v: (d: unknown) => unknown) => {
        validar = v;
        return b;
      },
      handler:
        (h: (a: unknown) => unknown) =>
        async (args: { data?: unknown; context?: unknown } = {}) =>
          h({ data: validar ? validar(args.data) : args.data, context: args.context }),
    };
    return b;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return mocks.admin;
  },
}));
vi.mock("@/integrations/supabase/auth-check.server", () => ({
  senhaConfere: mocks.senhaConfere,
  entrarComSenha: mocks.entrarComSenha,
}));
vi.mock("./face.server", async (orig) => ({
  ...(await orig<typeof import("./face.server")>()),
  buscarRosto: mocks.buscarRosto,
}));

import { hashSenha, assinarToken } from "./seguranca.server";
import * as T from "./terminal.functions";

const fn = <A, R>(f: unknown) => f as (a: { data: A; context?: unknown }) => Promise<R>;
const desbloquear = fn<{ documento: string; senha: string }, { token: string; modo: string }>(
  T.desbloquearTerminal,
);
const identificar = fn<{ token: string; imagem: string }, { encontrado: any }>(T.identificarRosto);
const confirmar = fn<
  { token: string; confirmacao: string; latitude: number; longitude: number },
  { tipo: string; nome: string }
>(T.confirmarPontoTerminal);
const cadastrarRosto = fn<any, { ok: boolean }>(T.cadastrarRostoTerminal);
const login = fn<{ documento: string; matricula: string; senha: string }, { access_token: string }>(
  T.loginPorMatricula,
);

const EMP = "emp-1";
const SELFIE = "data:image/jpeg;base64,/9j/AAAA";
const SP = { latitude: -23.55, longitude: -46.63 };

function cenario(extra: { raio_m?: number } = {}) {
  mocks.admin = criarFakeSupabase({
    empresas: [
      {
        id: EMP,
        documento: "11.222.333/0001-81",
        razao_social: "Padaria",
        senha_mestra_leitura: hashSenha("leitura123"),
        senha_mestra_cadastro: hashSenha("cadastro123"),
        latitude: SP.latitude,
        longitude: SP.longitude,
        raio_m: extra.raio_m ?? null,
      },
    ],
    funcionarios: [
      {
        id: "f-ana",
        empresa_id: EMP,
        nome: "Ana Souza",
        matricula: "A01",
        cpf: "111.444.777-35",
        ativo: true,
        foto_status: "aprovada",
        foto_path: "x",
      },
      {
        id: "f-novo",
        empresa_id: EMP,
        nome: "Caio",
        matricula: "C03",
        cpf: "935.411.347-80",
        ativo: true,
        foto_status: "sem_foto",
        foto_path: null,
      },
    ],
    pontos: [],
    terminal_logs: [],
    tentativas: [],
  });
}

async function tokenLeitura() {
  return (await desbloquear({ data: { documento: "11222333000181", senha: "leitura123" } })).token;
}

beforeEach(() => {
  vi.clearAllMocks();
  cenario();
});

describe("desbloqueio do terminal", () => {
  it("aceita CPF/CNPJ só com dígitos e devolve o modo pela senha", async () => {
    expect(
      (await desbloquear({ data: { documento: "11222333000181", senha: "leitura123" } })).modo,
    ).toBe("leitura");
    expect(
      (await desbloquear({ data: { documento: "11.222.333/0001-81", senha: "cadastro123" } })).modo,
    ).toBe("cadastro");
  });

  it("erro genérico e bloqueio após 8 tentativas erradas", async () => {
    for (let i = 0; i < 8; i++) {
      await expect(
        desbloquear({ data: { documento: "11222333000181", senha: `errada${i}` } }),
      ).rejects.toThrow("CPF/CNPJ ou senha mestra inválidos");
    }
    await expect(
      desbloquear({ data: { documento: "11222333000181", senha: "leitura123" } }),
    ).rejects.toThrow("Muitas tentativas");
  });

  it("trocar a senha mestra derruba os terminais já desbloqueados", async () => {
    const token = await tokenLeitura();
    mocks.admin.db.empresas[0].senha_mestra_leitura = hashSenha("novaSenha9");
    await expect(identificar({ data: { token, imagem: SELFIE } })).rejects.toThrow(
      "Desbloqueie novamente",
    );
  });

  it("token adulterado não vale", async () => {
    const token = await tokenLeitura();
    const [corpo] = token.split(".");
    await expect(
      identificar({ data: { token: `${corpo}.assinaturaFalsa`, imagem: SELFIE } }),
    ).rejects.toThrow("Desbloqueie novamente");
  });
});

describe("identificação e confirmação (fluxo do totem)", () => {
  it("rosto reconhecido: mostra dados com CPF parcial e o tipo da próxima marcação", async () => {
    mocks.buscarRosto.mockResolvedValue({ funcionarioId: "f-ana", similaridade: 99.2 });
    const r = await identificar({ data: { token: await tokenLeitura(), imagem: SELFIE } });
    expect(r.encontrado).toMatchObject({
      nome: "Ana Souza",
      matricula: "A01",
      cpf: "***.444.777-**",
      tipo: "ENTRADA",
    });
    expect(r.encontrado.cpf).not.toContain("111");
  });

  it("rosto desconhecido devolve nulo; falha do serviço NÃO vira 'não reconhecido'", async () => {
    const token = await tokenLeitura();
    mocks.buscarRosto.mockResolvedValue(null);
    expect((await identificar({ data: { token, imagem: SELFIE } })).encontrado).toBeNull();
    const { FaceErro } = await import("./face.server");
    mocks.buscarRosto.mockRejectedValue(
      new FaceErro("indisponivel", "Serviço de reconhecimento facial indisponível."),
    );
    await expect(identificar({ data: { token, imagem: SELFIE } })).rejects.toThrow("indisponível");
  });

  it("sem nenhum rosto aprovado, avisa que falta a aprovação do administrador", async () => {
    mocks.buscarRosto.mockResolvedValue(null);
    const token = await tokenLeitura();
    expect((await identificar({ data: { token, imagem: SELFIE } })).encontrado).toBeNull();
    mocks.admin.db.funcionarios[0].foto_status = "pendente";
    const r = await identificar({ data: { token, imagem: SELFIE } });
    expect(r).toMatchObject({ encontrado: null, semRostosAprovados: true });
    expect(mocks.admin.db.terminal_logs.at(-1).detalhe).toMatch(/Nenhum rosto aprovado/);
  });

  it("funcionário desativado ou com rosto não aprovado não é identificado", async () => {
    mocks.buscarRosto.mockResolvedValue({ funcionarioId: "f-ana", similaridade: 99 });
    mocks.admin.db.funcionarios[0].ativo = false;
    expect(
      (await identificar({ data: { token: await tokenLeitura(), imagem: SELFIE } })).encontrado,
    ).toBeNull();
  });

  it("confirmar grava o ponto com foto e localização; confirmação forjada é recusada", async () => {
    mocks.buscarRosto.mockResolvedValue({ funcionarioId: "f-ana", similaridade: 98.7 });
    const token = await tokenLeitura();
    const r = await identificar({ data: { token, imagem: SELFIE } });
    const ok = await confirmar({ data: { token, confirmacao: r.encontrado.confirmacao, ...SP } });
    expect(ok).toMatchObject({ tipo: "ENTRADA", nome: "Ana Souza" });
    const ponto = mocks.admin.db.pontos[0];
    expect(ponto).toMatchObject({
      funcionario_id: "f-ana",
      tipo: "ENTRADA",
      face_confianca: 0.987,
    });
    expect(mocks.admin.arquivos.has(ponto.selfie_path)).toBe(true);

    // Confirmação feita "à mão" com outro funcionário, sem a assinatura do servidor:
    const falsa =
      Buffer.from(
        JSON.stringify({ e: EMP, f: "f-novo", p: "x", s: 99, t: "confirmar", exp: 9e9 }),
      ).toString("base64url") + ".x";
    await expect(confirmar({ data: { token, confirmacao: falsa, ...SP } })).rejects.toThrow(
      "expirou",
    );
  });

  it("confirmação de outra empresa não é aceita", async () => {
    const token = await tokenLeitura();
    const outra = assinarToken("confirmar", { e: "emp-2", f: "f-ana", p: "x", s: 99 }, 90);
    await expect(confirmar({ data: { token, confirmacao: outra, ...SP } })).rejects.toThrow(
      "expirou",
    );
  });

  it("cerca geográfica: recusa marcação longe da empresa", async () => {
    cenario({ raio_m: 200 });
    mocks.buscarRosto.mockResolvedValue({ funcionarioId: "f-ana", similaridade: 99 });
    const token = await tokenLeitura();
    const r = await identificar({ data: { token, imagem: SELFIE } });
    await expect(
      confirmar({
        data: { token, confirmacao: r.encontrado.confirmacao, latitude: -22.9, longitude: -43.2 },
      }),
    ).rejects.toThrow("fora do local permitido");
    expect(mocks.admin.db.pontos).toHaveLength(0);
  });

  it("cerca geográfica: margem de erro do GPS evita barrar quem está no local", async () => {
    cenario({ raio_m: 50 });
    mocks.buscarRosto.mockResolvedValue({ funcionarioId: "f-ana", similaridade: 99 });
    const token = await tokenLeitura();
    const r = await identificar({ data: { token, imagem: SELFIE } });
    const longe78m = { latitude: SP.latitude - 78 / 111_320, longitude: SP.longitude };
    const ok = await confirmar({
      data: { token, confirmacao: r.encontrado.confirmacao, ...longe78m, precisao: 40 } as any,
    });
    expect(ok.tipo).toBe("ENTRADA");
    expect(mocks.admin.db.pontos).toHaveLength(1);
  });

  it("exige localização válida", async () => {
    await expect(
      confirmar({ data: { token: "x", confirmacao: "y", latitude: Number.NaN, longitude: 0 } }),
    ).rejects.toThrow("Localização obrigatória");
  });
});

describe("bloquear o terminal", () => {
  const bloquear = fn<{ token: string; senha: string }, { ok: boolean }>(T.bloquearTerminal);

  it("exige uma senha mestra válida", async () => {
    const token = await tokenLeitura();
    await expect(bloquear({ data: { token, senha: "" } })).rejects.toThrow("Digite a senha mestra");
    await expect(bloquear({ data: { token, senha: "chute123" } })).rejects.toThrow(
      "Senha mestra incorreta",
    );
    expect((await bloquear({ data: { token, senha: "leitura123" } })).ok).toBe(true);
    // a senha de cadastro também serve (o responsável pode saber só uma delas)
    expect((await bloquear({ data: { token, senha: "cadastro123" } })).ok).toBe(true);
    const acoes = mocks.admin.db.terminal_logs.map((l: any) => l.acao);
    expect(acoes).toContain("bloqueio_negado");
    expect(acoes).toContain("bloqueio");
  });

  it("trava após 8 senhas erradas", async () => {
    const token = await tokenLeitura();
    for (let i = 0; i < 8; i++)
      await expect(bloquear({ data: { token, senha: `errada${i}` } })).rejects.toThrow("incorreta");
    await expect(bloquear({ data: { token, senha: "leitura123" } })).rejects.toThrow(
      "Muitas tentativas",
    );
  });
});

describe("cadastro de rosto no terminal", () => {
  async function tokenCadastro() {
    return (await desbloquear({ data: { documento: "11222333000181", senha: "cadastro123" } }))
      .token;
  }
  const base = { funcionarioId: "f-novo", consentimento: true, imagem: SELFIE };

  it("senha de leitura não libera cadastro", async () => {
    await expect(
      cadastrarRosto({ data: { token: await tokenLeitura(), senhaFuncionario: "x", ...base } }),
    ).rejects.toThrow("não permite cadastrar");
  });

  it("exige a senha do próprio funcionário e o aceite do termo", async () => {
    const token = await tokenCadastro();
    await expect(
      cadastrarRosto({ data: { token, senhaFuncionario: "s", ...base, consentimento: false } }),
    ).rejects.toThrow("termo");
    mocks.senhaConfere.mockResolvedValue(false);
    await expect(
      cadastrarRosto({ data: { token, senhaFuncionario: "errada", ...base } }),
    ).rejects.toThrow("Senha do funcionário incorreta");
    expect(mocks.admin.db.funcionarios[1].foto_status).toBe("sem_foto");
  });

  it("com a senha certa, a foto fica pendente de aprovação do administrador", async () => {
    mocks.senhaConfere.mockResolvedValue(true);
    await cadastrarRosto({
      data: { token: await tokenCadastro(), senhaFuncionario: "certa", ...base },
    });
    const f = mocks.admin.db.funcionarios[1];
    expect(f.foto_status).toBe("pendente");
    expect(f.consentimento_biometria_em).toBeTruthy();
    expect(mocks.senhaConfere).toHaveBeenCalledWith(
      expect.stringMatching(/^func-.*-93541134780@pontoflex\.app$/),
      "certa",
    );
  });

  it("não troca o rosto de quem já está aprovado", async () => {
    mocks.senhaConfere.mockResolvedValue(true);
    await expect(
      cadastrarRosto({
        data: {
          token: await tokenCadastro(),
          senhaFuncionario: "certa",
          ...base,
          funcionarioId: "f-ana",
        },
      }),
    ).rejects.toThrow("já possui rosto");
  });
});

describe("login do funcionário", () => {
  it("usa empresa + matrícula (sem diferenciar maiúsculas) e não aceita curingas", async () => {
    mocks.entrarComSenha.mockResolvedValue({ access_token: "a", refresh_token: "r" });
    expect(
      (await login({ data: { documento: "11222333000181", matricula: "a01", senha: "s" } }))
        .access_token,
    ).toBe("a");
    expect(mocks.entrarComSenha).toHaveBeenCalledWith(
      expect.stringContaining("-11144477735@"),
      "s",
    );
    await expect(
      login({ data: { documento: "11222333000181", matricula: "%", senha: "s" } }),
    ).rejects.toThrow("Dados de acesso inválidos");
  });

  it("bloqueia depois de 6 senhas erradas para a mesma matrícula", async () => {
    mocks.entrarComSenha.mockResolvedValue(null);
    for (let i = 0; i < 6; i++)
      await expect(
        login({ data: { documento: "11222333000181", matricula: "A01", senha: "x" } }),
      ).rejects.toThrow("inválidos");
    await expect(
      login({ data: { documento: "11222333000181", matricula: "A01", senha: "x" } }),
    ).rejects.toThrow("Muitas tentativas");
  });
});

describe("senhas mestras", () => {
  it("exigem 8+ caracteres com letras e números", () => {
    expect(T.validarSenhaMestra("1234")).toMatch(/8 caracteres/);
    expect(T.validarSenhaMestra("abcdefgh")).toMatch(/letras e números/);
    expect(T.validarSenhaMestra("totem2026")).toBeNull();
  });
});
