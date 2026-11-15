import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cpfParcial, digits, funcionarioEmail, maskDocumento } from "./doc";
import { coordenadasValidas } from "./geo";
import { TIPO_LABEL, type Tipo } from "./ponto";
import type { Banco } from "@/integrations/supabase/banco";

type Modo = "leitura" | "cadastro";
type SessaoTerminal = { e: string; m: Modo; v: string };
type Confirmacao = { e: string; f: string; p: string; s: number };

const SESSAO_TERMINAL_SEG = 12 * 3600;
const CONFIRMACAO_SEG = 90;

async function servidor() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seg = await import("./seguranca.server");
  const { ipDaRequisicao } = await import("./requisicao.server");
  return { supabaseAdmin, ipDaRequisicao, ...seg };
}

/** Impressão da senha mestra atual: trocar a senha invalida terminais já desbloqueados. */
const versaoDe = (sha256: (s: string) => string, hash: string | null) =>
  hash ? sha256(hash).slice(0, 12) : "";

/** Valida o token do terminal e a senha vigente da empresa. */
async function sessaoValida(token: string, exigir?: Modo) {
  const s = await servidor();
  const dados = s.lerToken<SessaoTerminal>("terminal", token);
  if (!dados) throw new Error("Sessão do terminal expirada. Desbloqueie novamente.");
  const { data: emp } = await s.supabaseAdmin
    .from("empresas")
    .select(
      "id, razao_social, senha_mestra_leitura, senha_mestra_cadastro, latitude, longitude, raio_m",
    )
    .eq("id", dados.e)
    .maybeSingle();
  const atual = dados.m === "leitura" ? emp?.senha_mestra_leitura : emp?.senha_mestra_cadastro;
  if (!emp || versaoDe(s.sha256, atual ?? null) !== dados.v)
    throw new Error("Sessão do terminal expirada. Desbloqueie novamente.");
  if (exigir && dados.m !== exigir)
    throw new Error(
      exigir === "cadastro"
        ? "Esta senha não permite cadastrar rostos"
        : "Este terminal está no modo cadastro",
    );
  return { ...s, emp, modo: dados.m };
}

async function logTerminal(
  supabaseAdmin: Banco,
  empresaId: string,
  acao: string,
  funcionarioId?: string | null,
  detalhe?: string,
) {
  await supabaseAdmin.from("terminal_logs").insert({
    empresa_id: empresaId,
    acao,
    funcionario_id: funcionarioId ?? null,
    detalhe: detalhe ?? null,
  });
}

export const desbloquearTerminal = createServerFn({ method: "POST" })
  .validator((d: { documento: string; senha: string }) => {
    if (!digits(d?.documento ?? "") || !d?.senha)
      throw new Error("Informe o CPF/CNPJ e a senha mestra");
    return d;
  })
  .handler(async ({ data }) => {
    const s = await servidor();
    const doc = digits(data.documento);
    const chaves = [`terminal:${doc}`, `terminal-ip:${s.ipDaRequisicao()}`];
    await s.exigirAbaixoDoLimite(s.supabaseAdmin, chaves[0]!, 8, 15);
    await s.exigirAbaixoDoLimite(s.supabaseAdmin, chaves[1]!, 30, 15);
    const { data: emp } = await s.supabaseAdmin
      .from("empresas")
      .select("id, razao_social, senha_mestra_leitura, senha_mestra_cadastro")
      .eq("documento", maskDocumento(doc))
      .maybeSingle();
    const modo: Modo | null = !emp
      ? null
      : s.conferirSenha(data.senha, emp.senha_mestra_leitura)
        ? "leitura"
        : s.conferirSenha(data.senha, emp.senha_mestra_cadastro)
          ? "cadastro"
          : null;
    if (!emp || !modo) {
      for (const c of chaves) await s.registrarTentativa(s.supabaseAdmin, c);
      throw new Error("CPF/CNPJ ou senha mestra inválidos");
    }
    await s.limparTentativas(s.supabaseAdmin, chaves[0]!);
    await logTerminal(s.supabaseAdmin, emp.id, "desbloqueio", null, `Modo ${modo}`);
    const hash = modo === "leitura" ? emp.senha_mestra_leitura : emp.senha_mestra_cadastro;
    const token = s.assinarToken(
      "terminal",
      { e: emp.id, m: modo, v: versaoDe(s.sha256, hash) },
      SESSAO_TERMINAL_SEG,
    );
    return { token, modo, empresa: emp.razao_social as string };
  });

/**
 * Bloquear o terminal também exige uma senha mestra: o funcionário que está na frente do aparelho
 * não consegue desligar a leitura por engano ou de propósito.
 */
export const bloquearTerminal = createServerFn({ method: "POST" })
  .validator((d: { token: string; senha: string }) => {
    if (!d?.senha) throw new Error("Digite a senha mestra para bloquear o terminal");
    return d;
  })
  .handler(async ({ data }) => {
    const s = await sessaoValida(data.token);
    const chave = `bloquear:${s.emp.id}`;
    await s.exigirAbaixoDoLimite(s.supabaseAdmin, chave, 8, 15);
    const confere =
      s.conferirSenha(data.senha, s.emp.senha_mestra_leitura) ||
      s.conferirSenha(data.senha, s.emp.senha_mestra_cadastro);
    if (!confere) {
      await s.registrarTentativa(s.supabaseAdmin, chave);
      await logTerminal(
        s.supabaseAdmin,
        s.emp.id,
        "bloqueio_negado",
        null,
        "Senha mestra incorreta",
      );
      throw new Error("Senha mestra incorreta");
    }
    await s.limparTentativas(s.supabaseAdmin, chave);
    await logTerminal(s.supabaseAdmin, s.emp.id, "bloqueio", null, `Modo ${s.modo}`);
    return { ok: true };
  });

/** Identifica o funcionário pelo rosto (1 consulta ao Rekognition) e prepara a confirmação. */
export const identificarRosto = createServerFn({ method: "POST" })
  .validator((d: { token: string; imagem: string }) => d)
  .handler(async ({ data }) => {
    const { validarImagem, buscarRosto, dataUrlToBytes, FaceErro } = await import("./face.server");
    const imagem = validarImagem(data?.imagem);
    const { supabaseAdmin, emp, assinarToken, exigirAbaixoDoLimite, registrarTentativa } =
      await sessaoValida(data.token, "leitura");
    // Freio de custo/abuso: até 60 identificações por minuto por empresa.
    await exigirAbaixoDoLimite(
      supabaseAdmin,
      `ident:${emp.id}`,
      60,
      1,
      "Muitas leituras seguidas. Aguarde alguns segundos.",
    );
    await registrarTentativa(supabaseAdmin, `ident:${emp.id}`);

    const bytes = dataUrlToBytes(imagem);
    let achado: Awaited<ReturnType<typeof buscarRosto>>;
    try {
      achado = await buscarRosto(emp.id, bytes);
    } catch (e) {
      await logTerminal(
        supabaseAdmin,
        emp.id,
        e instanceof FaceErro && e.codigo === "indisponivel"
          ? "verificacao_indisponivel"
          : "identificacao_falhou",
        null,
        (e as Error).message,
      );
      throw e;
    }
    if (!achado) {
      // Sem nenhum rosto aprovado, a falha é de configuração, não do rosto: avisar o motivo.
      const { count: aprovados } = await supabaseAdmin
        .from("funcionarios")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", emp.id)
        .eq("foto_status", "aprovada");
      const motivo = aprovados
        ? "Rosto não reconhecido"
        : "Nenhum rosto aprovado ainda (aprovar em Funcionários)";
      await logTerminal(supabaseAdmin, emp.id, "identificacao_falhou", null, motivo);
      return { encontrado: null, semRostosAprovados: !aprovados };
    }
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, matricula, cpf, ativo, foto_status")
      .eq("id", achado.funcionarioId)
      .eq("empresa_id", emp.id)
      .maybeSingle();
    if (!f || !f.ativo || f.foto_status !== "aprovada") {
      await logTerminal(
        supabaseAdmin,
        emp.id,
        "identificacao_falhou",
        f?.id ?? null,
        "Funcionário inativo ou rosto não aprovado",
      );
      return { encontrado: null };
    }
    const { proximaMarcacao } = await import("./ponto.server");
    const tipo = await proximaMarcacao(supabaseAdmin, f.id);
    const path = `${emp.id}/${f.id}/${Date.now()}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("faces")
      .upload(path, bytes, { contentType: "image/jpeg" });
    if (upErr) throw new Error("Não foi possível salvar a foto da marcação. Tente novamente.");
    await logTerminal(
      supabaseAdmin,
      emp.id,
      "identificado",
      f.id,
      `Similaridade ${achado.similaridade.toFixed(1)}%`,
    );
    return {
      encontrado: {
        nome: f.nome as string,
        matricula: f.matricula as string,
        cpf: cpfParcial(f.cpf),
        tipo,
        tipoLabel: tipo ? TIPO_LABEL[tipo] : null,
        similaridade: Math.round(achado.similaridade * 10) / 10,
        confirmacao: assinarToken(
          "confirmar",
          { e: emp.id, f: f.id, p: path, s: achado.similaridade },
          CONFIRMACAO_SEG,
        ),
      },
    };
  });

/** O funcionário conferiu os dados na tela e tocou em "Confirmar". */
export const confirmarPontoTerminal = createServerFn({ method: "POST" })
  .validator(
    (d: {
      token: string;
      confirmacao: string;
      latitude: number;
      longitude: number;
      precisao?: number;
    }) => {
      if (!coordenadasValidas(d?.latitude, d?.longitude))
        throw new Error("Localização obrigatória. Permita o acesso à localização neste terminal.");
      return d;
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, emp, lerToken } = await sessaoValida(data.token, "leitura");
    const c = lerToken<Confirmacao>("confirmar", data.confirmacao);
    if (!c || c.e !== emp.id) {
      await logTerminal(
        supabaseAdmin,
        emp.id,
        "registro_negado",
        null,
        "Confirmação expirada (mais de 90 s) ou inválida",
      );
      throw new Error("A confirmação expirou. Faça a leitura do rosto novamente.");
    }
    const { registrarMarcacao } = await import("./ponto.server");
    let r: Awaited<ReturnType<typeof registrarMarcacao>>;
    try {
      r = await registrarMarcacao(supabaseAdmin, {
        empresa: emp,
        funcionarioId: c.f,
        selfiePath: c.p,
        similaridade: c.s,
        latitude: data.latitude,
        longitude: data.longitude,
        precisao: data.precisao,
      });
    } catch (e) {
      await logTerminal(supabaseAdmin, emp.id, "registro_negado", c.f, (e as Error).message);
      throw e;
    }
    await logTerminal(
      supabaseAdmin,
      emp.id,
      "registro",
      c.f,
      `${TIPO_LABEL[r.tipo]} às ${r.data_hora}${r.distancia_m != null ? ` (${r.distancia_m} m)` : ""}`,
    );
    return r;
  });

export const recusarIdentificacao = createServerFn({ method: "POST" })
  .validator((d: { token: string; confirmacao: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, emp, lerToken } = await sessaoValida(data.token, "leitura");
    const c = lerToken<Confirmacao>("confirmar", data.confirmacao);
    if (c && c.e === emp.id)
      await logTerminal(
        supabaseAdmin,
        emp.id,
        "identificacao_rejeitada",
        c.f,
        `Funcionário informou "não sou eu". Foto: ${c.p}`,
      );
    return { ok: true };
  });

/** Modo cadastro: funcionários ativos ainda sem rosto aprovado. */
export const listarSemRosto = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin, emp } = await sessaoValida(data.token, "cadastro");
    const { data: funcs } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, matricula, foto_status")
      .eq("empresa_id", emp.id)
      .eq("ativo", true)
      .in("foto_status", ["sem_foto", "recusada"])
      .order("nome");
    return {
      funcionarios: (funcs ?? []) as {
        id: string;
        nome: string;
        matricula: string;
        foto_status: string;
      }[],
    };
  });

/** Cadastro do rosto no totem: o próprio funcionário confirma com a senha dele e aceita o termo. */
export const cadastrarRostoTerminal = createServerFn({ method: "POST" })
  .validator(
    (d: {
      token: string;
      funcionarioId: string;
      senhaFuncionario: string;
      consentimento: boolean;
      imagem: string;
    }) => {
      if (!d?.senhaFuncionario) throw new Error("O funcionário precisa digitar a própria senha");
      if (d.consentimento !== true)
        throw new Error("É preciso aceitar o termo de uso da biometria");
      return d;
    },
  )
  .handler(async ({ data }) => {
    const { validarImagem } = await import("./face.server");
    const imagem = validarImagem(data.imagem);
    const { supabaseAdmin, emp, exigirAbaixoDoLimite, registrarTentativa, limparTentativas } =
      await sessaoValida(data.token, "cadastro");
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, cpf, foto_path, foto_status, ativo")
      .eq("id", data.funcionarioId)
      .eq("empresa_id", emp.id)
      .maybeSingle();
    if (!f || !f.ativo || !["sem_foto", "recusada"].includes(f.foto_status))
      throw new Error("Funcionário não encontrado ou já possui rosto cadastrado");
    const chave = `senha-func:${f.id}`;
    await exigirAbaixoDoLimite(supabaseAdmin, chave, 5, 15);
    const { senhaConfere } = await import("@/integrations/supabase/auth-check.server");
    if (!(await senhaConfere(funcionarioEmail(emp.id, f.cpf), data.senhaFuncionario))) {
      await registrarTentativa(supabaseAdmin, chave);
      throw new Error("Senha do funcionário incorreta");
    }
    await limparTentativas(supabaseAdmin, chave);
    const { salvarReferencia } = await import("./ponto.server");
    await salvarReferencia(supabaseAdmin, { empresaId: emp.id, funcionario: f, imagem });
    await logTerminal(
      supabaseAdmin,
      emp.id,
      "cadastro_rosto",
      f.id,
      `Rosto de ${f.nome} enviado para aprovação`,
    );
    return { ok: true, nome: f.nome as string };
  });

/** Login do funcionário: CPF/CNPJ da empresa + matrícula + senha. */
export const loginPorMatricula = createServerFn({ method: "POST" })
  .validator((d: { documento: string; matricula: string; senha: string }) => {
    if (!digits(d?.documento ?? "") || !d?.matricula?.trim() || !d?.senha)
      throw new Error("Informe o CPF/CNPJ da empresa, a matrícula e a senha");
    return d;
  })
  .handler(async ({ data }) => {
    const s = await servidor();
    const doc = digits(data.documento);
    const matricula = data.matricula.trim().toLowerCase();
    const chaves = [`login:${doc}:${matricula}`, `login-ip:${s.ipDaRequisicao()}`];
    await s.exigirAbaixoDoLimite(s.supabaseAdmin, chaves[0]!, 6, 15);
    await s.exigirAbaixoDoLimite(s.supabaseAdmin, chaves[1]!, 40, 15);
    const falhar = async (): Promise<never> => {
      for (const c of chaves) await s.registrarTentativa(s.supabaseAdmin, c);
      throw new Error("Dados de acesso inválidos");
    };
    const { data: emp } = await s.supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("documento", maskDocumento(doc))
      .maybeSingle();
    if (!emp) return falhar();
    const { data: funcs } = await s.supabaseAdmin
      .from("funcionarios")
      .select("cpf, matricula, ativo")
      .eq("empresa_id", emp.id);
    const f = (funcs ?? []).find(
      (x: { matricula: string }) => x.matricula.trim().toLowerCase() === matricula,
    );
    if (!f || !f.ativo) return falhar();
    const { entrarComSenha } = await import("@/integrations/supabase/auth-check.server");
    const sess = await entrarComSenha(funcionarioEmail(emp.id, f.cpf), data.senha);
    if (!sess) return falhar();
    await s.limparTentativas(s.supabaseAdmin, chaves[0]!);
    return { access_token: sess.access_token, refresh_token: sess.refresh_token };
  });

// ---------- Administrador ----------

export function validarSenhaMestra(s: string): string | null {
  if (s.length < 8) return "A senha mestra precisa ter pelo menos 8 caracteres";
  if (!/[a-zA-Z]/.test(s) || !/\d/.test(s)) return "Use letras e números na senha mestra";
  return null;
}

export const definirSenhasMestras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { leitura?: string; cadastro?: string }) => {
    const leitura = d?.leitura ?? "";
    const cadastro = d?.cadastro ?? "";
    if (!leitura && !cadastro) throw new Error("Informe ao menos uma senha");
    for (const s of [leitura, cadastro].filter(Boolean)) {
      const erro = validarSenhaMestra(s);
      if (erro) throw new Error(erro);
    }
    if (leitura && cadastro && leitura === cadastro)
      throw new Error("As senhas de leitura e de cadastro devem ser diferentes");
    return { leitura, cadastro };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, hashSenha, conferirSenha } = await servidor();
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, senha_mestra_leitura, senha_mestra_cadastro")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!emp) throw new Error("Apenas o administrador da empresa pode definir as senhas");
    if (data.leitura && conferirSenha(data.leitura, emp.senha_mestra_cadastro))
      throw new Error("A senha de leitura não pode ser igual à de cadastro");
    if (data.cadastro && conferirSenha(data.cadastro, emp.senha_mestra_leitura))
      throw new Error("A senha de cadastro não pode ser igual à de leitura");
    const upd: { senha_mestra_leitura?: string; senha_mestra_cadastro?: string } = {};
    if (data.leitura) upd.senha_mestra_leitura = hashSenha(data.leitura);
    if (data.cadastro) upd.senha_mestra_cadastro = hashSenha(data.cadastro);
    const { error } = await supabaseAdmin.from("empresas").update(upd).eq("id", emp.id);
    if (error) throw new Error("Não foi possível salvar as senhas");
    return { ok: true };
  });

export const listarTerminalLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("terminal_logs")
      .select("id, acao, detalhe, data_hora, funcionarios(nome)")
      .order("data_hora", { ascending: false })
      .limit(50);
    return { logs: data ?? [] };
  });

export type { Tipo };
