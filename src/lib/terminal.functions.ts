import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { funcionarioEmail } from "./doc";
import { nextTipo, TIPO_LABEL, type Tipo } from "./ponto";

const MIN_CONFIANCA = 0.7;
type Modo = "leitura" | "cadastro";

function validarImagem(img: unknown): string {
  if (typeof img !== "string" || !img.startsWith("data:image/jpeg;base64,")) throw new Error("Foto inválida");
  if (img.length > 3_000_000) throw new Error("Foto muito grande");
  return img;
}

/** Validates CNPJ + master password; returns the empresa and which mode the password unlocks. */
async function empresaPorSenha(cnpj: string, senha: string) {
  if (!cnpj || !senha) throw new Error("Informe o CNPJ e a senha mestra");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sha256 } = await import("./face.server");
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id, razao_social, senha_mestra_leitura, senha_mestra_cadastro")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (!emp) throw new Error("Empresa não encontrada");
  const hash = await sha256(senha);
  const modo: Modo | null =
    emp.senha_mestra_leitura && hash === emp.senha_mestra_leitura
      ? "leitura"
      : emp.senha_mestra_cadastro && hash === emp.senha_mestra_cadastro
        ? "cadastro"
        : null;
  if (!modo) throw new Error("Senha mestra inválida");
  return { emp, modo, supabaseAdmin };
}

async function logTerminal(supabaseAdmin: any, empresaId: string, acao: string, funcionarioId?: string | null, detalhe?: string) {
  await supabaseAdmin.from("terminal_logs").insert({ empresa_id: empresaId, acao, funcionario_id: funcionarioId ?? null, detalhe: detalhe ?? null });
}

export const desbloquearTerminal = createServerFn({ method: "POST" })
  .inputValidator((d: { cnpj: string; senha: string }) => d)
  .handler(async ({ data }) => {
    const { emp, modo } = await empresaPorSenha(data.cnpj.trim(), data.senha);
    return { modo, empresa: emp.razao_social };
  });

/** Identifies an employee by face among all enrolled employees of the company. */
export const identificarRosto = createServerFn({ method: "POST" })
  .inputValidator((d: { cnpj: string; senha: string; imagem: string }) => ({ ...d, imagem: validarImagem(d?.imagem) }))
  .handler(async ({ data }) => {
    const { emp, supabaseAdmin } = await empresaPorSenha(data.cnpj.trim(), data.senha);
    const { compararRostos, bytesToDataUrl } = await import("./face.server");
    const { data: funcs, error: funcsError } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, matricula, cpf, foto_path")
      .eq("empresa_id", emp.id)
      .eq("ativo", true)
      .not("foto_path", "is", null);
    if (funcsError) throw new Error("Não foi possível consultar os rostos cadastrados.");
    if (!funcs?.length) throw new Error("Nenhum funcionário ativo tem rosto cadastrado. Use o modo cadastro primeiro.");
    let best: { f: (typeof funcs extends (infer T)[] | null ? T : never); confianca: number } | null = null;
    let referenceFailures = 0;
    for (const f of funcs ?? []) {
      if (!f.foto_path) { referenceFailures++; continue; }
      const { data: ref, error: refError } = await supabaseAdmin.storage.from("faces").download(f.foto_path);
      if (refError || !ref) { referenceFailures++; continue; }
      try {
        const r = await compararRostos(bytesToDataUrl(new Uint8Array(await ref.arrayBuffer())), data.imagem);
        if (r.rosto_real && r.mesma_pessoa && r.confianca >= MIN_CONFIANCA && (!best || r.confianca > best.confianca))
          best = { f, confianca: r.confianca };
      } catch (error) {
        await logTerminal(supabaseAdmin, emp.id, "verificacao_indisponivel", null, error instanceof Error ? error.message : "Falha no serviço facial");
        throw error;
      }
    }
    if (!best) {
      if (referenceFailures) {
        await logTerminal(supabaseAdmin, emp.id, "referencia_indisponivel", null, "Não foi possível carregar todas as fotos cadastradas");
        throw new Error("Uma foto cadastrada está indisponível. Peça ao administrador para verificar ou redefinir o rosto.");
      }
      await logTerminal(supabaseAdmin, emp.id, "identificacao_falhou", null, "Rosto não reconhecido");
      return { encontrado: null };
    }
    await logTerminal(supabaseAdmin, emp.id, "identificado", best.f.id, `Confiança ${Math.round(best.confianca * 100)}%`);
    return {
      encontrado: {
        id: best.f.id,
        nome: best.f.nome,
        matricula: best.f.matricula,
        cpf: best.f.cpf,
        confianca: best.confianca,
      },
    };
  });

/** Registers the next punch for the identified employee, re-verifying the face. */
export const confirmarPontoTerminal = createServerFn({ method: "POST" })
  .inputValidator((d: { cnpj: string; senha: string; funcionarioId: string; imagem: string; latitude: number; longitude: number }) => {
    if (!Number.isFinite(d?.latitude) || !Number.isFinite(d?.longitude)) throw new Error("Localização obrigatória");
    return { ...d, imagem: validarImagem(d?.imagem) };
  })
  .handler(async ({ data }) => {
    const { emp, supabaseAdmin } = await empresaPorSenha(data.cnpj.trim(), data.senha);
    const { compararRostos, bytesToDataUrl, dataUrlToBytes } = await import("./face.server");
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, foto_path, ativo")
      .eq("id", data.funcionarioId)
      .eq("empresa_id", emp.id)
      .maybeSingle();
    if (!f || !f.ativo || !f.foto_path) throw new Error("Funcionário não encontrado");

    const { data: ref, error: refErr } = await supabaseAdmin.storage.from("faces").download(f.foto_path);
    if (refErr || !ref) throw new Error("Foto de referência não encontrada");
    const r = await compararRostos(bytesToDataUrl(new Uint8Array(await ref.arrayBuffer())), data.imagem);
    if (!r.rosto_real || !r.mesma_pessoa || r.confianca < MIN_CONFIANCA) {
      await logTerminal(supabaseAdmin, emp.id, "registro_negado", f.id, "Rosto não confirmado");
      throw new Error("Rosto não confirmado. O ponto não foi registrado.");
    }

    const since = new Date(Date.now() - 30 * 3600_000).toISOString();
    const { data: pts } = await supabaseAdmin.from("pontos").select("tipo, data_hora").eq("funcionario_id", f.id).gte("data_hora", since).order("data_hora");
    const tipo = nextTipo(pts ?? []) as Tipo | null;
    if (!tipo) throw new Error("Aguarde para registrar a próxima marcação");

    const path = `${emp.id}/${f.id}/${Date.now()}.jpg`;
    await supabaseAdmin.storage.from("faces").upload(path, dataUrlToBytes(data.imagem), { contentType: "image/jpeg" });
    const { data: ins, error } = await supabaseAdmin
      .from("pontos")
      .insert({
        funcionario_id: f.id,
        empresa_id: emp.id,
        tipo,
        latitude: data.latitude,
        longitude: data.longitude,
        selfie_path: path,
        face_status: "aprovado",
        face_confianca: r.confianca,
      })
      .select("tipo, data_hora")
      .single();
    if (error) throw new Error(error.message.includes("esperada") || error.message.includes("encerrada") ? error.message : "Não foi possível registrar o ponto");
    await logTerminal(supabaseAdmin, emp.id, "registro", f.id, `${TIPO_LABEL[ins.tipo as Tipo]} às ${ins.data_hora}`);
    return { tipo: ins.tipo as Tipo, data_hora: ins.data_hora, nome: f.nome, confianca: r.confianca };
  });

/** Cadastro mode: employees still missing the face reference photo. */
export const listarSemRosto = createServerFn({ method: "POST" })
  .inputValidator((d: { cnpj: string; senha: string }) => d)
  .handler(async ({ data }) => {
    const { emp, modo, supabaseAdmin } = await empresaPorSenha(data.cnpj.trim(), data.senha);
    if (modo !== "cadastro") throw new Error("Esta senha não permite cadastrar rostos");
    const { data: funcs } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome, matricula")
      .eq("empresa_id", emp.id)
      .eq("ativo", true)
      .is("foto_path", null)
      .order("nome");
    return { funcionarios: funcs ?? [] };
  });

export const cadastrarRostoTerminal = createServerFn({ method: "POST" })
  .inputValidator((d: { cnpj: string; senha: string; funcionarioId: string; imagem: string }) => ({ ...d, imagem: validarImagem(d?.imagem) }))
  .handler(async ({ data }) => {
    const { emp, modo, supabaseAdmin } = await empresaPorSenha(data.cnpj.trim(), data.senha);
    if (modo !== "cadastro") throw new Error("Esta senha não permite cadastrar rostos");
    const { dataUrlToBytes } = await import("./face.server");
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, nome")
      .eq("id", data.funcionarioId)
      .eq("empresa_id", emp.id)
      .is("foto_path", null)
      .maybeSingle();
    if (!f) throw new Error("Funcionário não encontrado ou já possui rosto cadastrado");
    const path = `${emp.id}/${f.id}/referencia-${Date.now()}.jpg`;
    const { error } = await supabaseAdmin.storage.from("faces").upload(path, dataUrlToBytes(data.imagem), { contentType: "image/jpeg" });
    if (error) throw new Error("Não foi possível salvar a foto");
    await supabaseAdmin.from("funcionarios").update({ foto_path: path }).eq("id", f.id);
    await logTerminal(supabaseAdmin, emp.id, "cadastro_rosto", f.id, `Rosto de ${f.nome} cadastrado no terminal`);
    return { ok: true, nome: f.nome };
  });

/** Employee login by matrícula + generated password; returns a session for the client to set. */
export const loginPorMatricula = createServerFn({ method: "POST" })
  .inputValidator((d: { matricula: string; senha: string }) => {
    if (!d?.matricula?.trim() || !d?.senha) throw new Error("Informe a matrícula e a senha");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("cpf, ativo")
      .ilike("matricula", data.matricula.trim())
      .maybeSingle();
    if (!f) throw new Error("Matrícula ou senha inválidos");
    if (!f.ativo) throw new Error("Seu acesso está desativado. Fale com o administrador.");
    const { data: sess, error } = await supabaseAdmin.auth.signInWithPassword({
      email: funcionarioEmail(f.cpf),
      password: data.senha,
    });
    if (error || !sess.session) throw new Error("Matrícula ou senha inválidos");
    return { access_token: sess.session.access_token, refresh_token: sess.session.refresh_token };
  });

// ---------- Admin ----------

export const definirSenhasMestras = createServerFn({ method: "POST" })
  .inputValidator((d: { leitura?: string; cadastro?: string }) => {
    if ((d.leitura ?? "").length < 4 && (d.cadastro ?? "").length < 4) throw new Error("Informe ao menos uma senha (mín. 4 caracteres)");
    return d;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { sha256 } = await import("./face.server");
    const upd: { senha_mestra_leitura?: string; senha_mestra_cadastro?: string } = {};
    if (data.leitura) upd["senha_mestra_leitura"] = await sha256(data.leitura);
    if (data.cadastro) upd["senha_mestra_cadastro"] = await sha256(data.cadastro);
    const { error } = await context.supabase.from("empresas").update(upd).eq("user_id", context.userId);
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
