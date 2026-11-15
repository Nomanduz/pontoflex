// Painel da equipe NOMANDUZ - TECH and IA: aprovação de empresas e gestão da plataforma.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIAS_TESTE, VALIDADE_CODIGO_MS } from "./cadastro.functions";
import type { Banco, Linha } from "@/integrations/supabase/banco";

async function exigirSuperadmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito à equipe Nomanduz");
  return supabaseAdmin;
}

export const listarSolicitacoesCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { data } = await admin
      .from("solicitacoes_cadastro")
      .select(
        "id, tipo_documento, documento, razao_social, responsavel, email, telefone, qtd_funcionarios, mensagem, status, codigo_expira_em, observacao, created_at, analisado_em, ativado_em",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return { solicitacoes: data ?? [] };
  });

async function enviarCodigo(admin: Banco, sol: Linha<"solicitacoes_cadastro">) {
  const { gerarCodigoAtivacao, normalizarCodigo, sha256 } = await import("./seguranca.server");
  const { urlDoApp } = await import("./requisicao.server");
  const codigo = gerarCodigoAtivacao();
  const expira = new Date(Date.now() + VALIDADE_CODIGO_MS);
  const { error } = await admin
    .from("solicitacoes_cadastro")
    .update({
      status: "aprovada",
      codigo_hash: sha256(normalizarCodigo(codigo)),
      codigo_expira_em: expira.toISOString(),
      analisado_em: new Date().toISOString(),
    })
    .eq("id", sol.id);
  if (error) throw new Error("Não foi possível gerar o código");
  const link = `${urlDoApp()}/ativar?codigo=${normalizarCodigo(codigo)}`;
  let emailEnviado = false;
  try {
    const { sendTemplateEmail, emailNomanduz } = await import("./email-templates/send-email");
    const r = await sendTemplateEmail("ativacao", sol.email, {
      templateData: {
        ...sol,
        codigo,
        link,
        validade: expira.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        diasTeste: DIAS_TESTE,
      },
      replyTo: emailNomanduz(),
    });
    emailEnviado = r.sent;
  } catch (e) {
    console.error("email ativacao", e);
  }
  // O código também volta para o painel: a equipe pode enviar por WhatsApp se o e-mail falhar.
  return { codigo, link, emailEnviado };
}

export const aprovarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { data: sol } = await admin
      .from("solicitacoes_cadastro")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!sol) throw new Error("Solicitação não encontrada");
    if (!["pendente", "aprovada"].includes(sol.status))
      throw new Error("Esta solicitação já foi concluída");
    const { data: existe } = await admin
      .from("empresas")
      .select("id")
      .eq("documento", sol.documento)
      .maybeSingle();
    if (existe) throw new Error("Já existe uma empresa com este documento");
    return enviarCodigo(admin, sol);
  });

export const recusarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; observacao?: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { data: sol } = await admin
      .from("solicitacoes_cadastro")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!sol || sol.status === "ativada")
      throw new Error("Solicitação não encontrada ou já ativada");
    const observacao = data.observacao?.trim().slice(0, 500) || null;
    await admin
      .from("solicitacoes_cadastro")
      .update({
        status: "recusada",
        observacao,
        codigo_hash: null,
        analisado_em: new Date().toISOString(),
      })
      .eq("id", sol.id);
    try {
      const { sendTemplateEmail, emailNomanduz } = await import("./email-templates/send-email");
      await sendTemplateEmail("solicitacao-recusada", sol.email, {
        templateData: { ...sol, observacao },
        replyTo: emailNomanduz(),
      });
    } catch (e) {
      console.error("email recusa", e);
    }
    return { ok: true };
  });

export const listarEmpresas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { data: emps } = await admin
      .from("empresas")
      .select(
        "id, razao_social, documento, tipo_documento, responsavel, email, status, teste_ate, created_at",
      )
      .order("created_at", { ascending: false });
    const { data: funcs } = await admin.from("funcionarios").select("empresa_id, ativo");
    const total = new Map<string, number>();
    for (const f of funcs ?? [])
      if (f.ativo) total.set(f.empresa_id, (total.get(f.empresa_id) ?? 0) + 1);
    return {
      empresas: (emps ?? []).map((e) => ({ ...e, funcionarios_ativos: total.get(e.id) ?? 0 })),
    };
  });

export const alterarStatusEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; status: "teste" | "ativa" | "suspensa" }) => {
    if (!["teste", "ativa", "suspensa"].includes(d?.status)) throw new Error("Status inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { error } = await admin
      .from("empresas")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível alterar o status");
    return { ok: true };
  });

/**
 * Empresa esqueceu a senha: gera um link de uso único (24 h) para criar uma senha nova.
 * Tenta mandar por e-mail; o link também volta para o painel, para envio pelo WhatsApp.
 */
export const gerarLinkRedefinicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { data: emp } = await admin
      .from("empresas")
      .select("id, razao_social, responsavel, email")
      .eq("id", data.id)
      .maybeSingle();
    if (!emp) throw new Error("Empresa não encontrada");
    const { criarRedefinicao } = await import("./redefinir.server");
    const r = await criarRedefinicao(admin, emp, "nomanduz");
    return { codigo: r.codigo, link: r.link, emailEnviado: r.emailEnviado };
  });

/**
 * Remove uma empresa inteira (ex.: empresa de teste): funcionários, marcações, fotos,
 * coleção facial e acessos. Exige digitar o CPF/CNPJ para confirmar.
 */
export const excluirEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; confirmacao: string }) => d)
  .handler(async ({ data, context }) => {
    const admin = await exigirSuperadmin(context.userId);
    const { digits } = await import("./doc");
    const { data: emp } = await admin
      .from("empresas")
      .select("id, documento, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!emp) throw new Error("Empresa não encontrada");
    if (digits(data.confirmacao ?? "") !== digits(emp.documento))
      throw new Error("Digite o CPF/CNPJ da empresa para confirmar a exclusão");

    const { data: funcs } = await admin
      .from("funcionarios")
      .select("id, user_id")
      .eq("empresa_id", emp.id);
    // Fotos: pasta da empresa e subpastas de cada funcionário.
    for (const f of funcs ?? []) {
      const { data: arquivos } = await admin.storage
        .from("faces")
        .list(`${emp.id}/${f.id}`, { limit: 1000 });
      if (arquivos?.length)
        await admin.storage
          .from("faces")
          .remove(arquivos.map((a: { name: string }) => `${emp.id}/${f.id}/${a.name}`));
    }
    const { removerColecao } = await import("./face.server");
    try {
      await removerColecao(emp.id);
    } catch (e) {
      console.error("remover coleção", e);
    }

    const { error } = await admin.from("empresas").delete().eq("id", emp.id);
    if (error) throw new Error(`Não foi possível excluir a empresa: ${error.message}`);
    for (const f of funcs ?? []) if (f.user_id) await admin.auth.admin.deleteUser(f.user_id);
    await admin.auth.admin.deleteUser(emp.user_id);
    await admin
      .from("solicitacoes_cadastro")
      .update({ status: "recusada", observacao: "Empresa excluída pela equipe Nomanduz" })
      .eq("empresa_id", emp.id);
    return { ok: true };
  });
