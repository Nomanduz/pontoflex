import { createServerFn } from "@tanstack/react-start";
import { documentoEmpresa, empresaEmail } from "./doc";

export const DIAS_TESTE = 30;
const VALIDADE_CODIGO_DIAS = 7;

/**
 * Senha da empresa: 8 caracteres ou mais, com letras e números. Sem teto curto, para aceitar as
 * senhas geradas pelo navegador (o Chrome sugere cerca de 15); 72 é o limite do login.
 */
export function validarSenhaEmpresa(n: string): string | null {
  if (n.length < 8) return "A senha precisa ter pelo menos 8 caracteres";
  if (n.length > 72) return "A senha pode ter no máximo 72 caracteres";
  if (!/[a-zA-Z]/.test(n) || !/\d/.test(n)) return "Use letras e números na senha";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Pedido = {
  documento: string;
  razao_social: string;
  responsavel: string;
  email: string;
  telefone?: string;
  qtd_funcionarios?: number | null;
  mensagem?: string;
  /** Campo invisível contra robôs: pessoas não preenchem. */
  site?: string;
};

/** Página pública "Cadastre sua empresa": a solicitação vai para a equipe Nomanduz. */
export const solicitarCadastro = createServerFn({ method: "POST" })
  .validator((d: Pedido) => {
    const doc = documentoEmpresa(d?.documento ?? "");
    const razao = d.razao_social?.trim() ?? "";
    const resp = d.responsavel?.trim() ?? "";
    const email = d.email?.trim().toLowerCase() ?? "";
    if (razao.length < 2) throw new Error("Informe o nome da empresa");
    if (resp.length < 2) throw new Error("Informe o nome do responsável");
    if (!EMAIL_RE.test(email)) throw new Error("Informe um e-mail válido");
    const qtd =
      d.qtd_funcionarios == null || Number.isNaN(Number(d.qtd_funcionarios))
        ? null
        : Math.max(0, Math.min(100000, Math.round(Number(d.qtd_funcionarios))));
    return {
      ...doc,
      razao_social: razao.slice(0, 255),
      responsavel: resp.slice(0, 255),
      email: email.slice(0, 255),
      telefone: d.telefone?.trim().slice(0, 20) || null,
      qtd_funcionarios: qtd,
      mensagem: d.mensagem?.trim().slice(0, 1000) || null,
      robo: Boolean(d.site),
    };
  })
  .handler(async ({ data }) => {
    if (data.robo) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { exigirAbaixoDoLimite, registrarTentativa } = await import("./seguranca.server");
    const { ipDaRequisicao, urlDoApp } = await import("./requisicao.server");
    const ip = ipDaRequisicao();
    await exigirAbaixoDoLimite(
      supabaseAdmin,
      `cadastro-ip:${ip}`,
      5,
      60,
      "Muitos pedidos deste endereço. Tente novamente mais tarde.",
    );
    await registrarTentativa(supabaseAdmin, `cadastro-ip:${ip}`);

    const { data: existe } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("documento", data.documento)
      .maybeSingle();
    if (existe)
      throw new Error(
        `Já existe uma empresa cadastrada com este ${data.tipo}. Entre pela página de login.`,
      );
    const { data: aberto } = await supabaseAdmin
      .from("solicitacoes_cadastro")
      .select("id")
      .eq("documento", data.documento)
      .in("status", ["pendente", "aprovada"])
      .maybeSingle();
    if (aberto)
      throw new Error(
        "Já recebemos um pedido para este documento. Aguarde o e-mail da nossa equipe.",
      );

    const { data: sol, error } = await supabaseAdmin
      .from("solicitacoes_cadastro")
      .insert({
        tipo_documento: data.tipo,
        documento: data.documento,
        razao_social: data.razao_social,
        responsavel: data.responsavel,
        email: data.email,
        telefone: data.telefone,
        qtd_funcionarios: data.qtd_funcionarios,
        mensagem: data.mensagem,
        ip,
      })
      .select("id")
      .single();
    if (error || !sol) throw new Error("Não foi possível enviar o pedido. Tente novamente.");

    const { sendTemplateEmail, emailNomanduz } = await import("./email-templates/send-email");
    const dados = { ...data, tipo_documento: data.tipo, link: `${urlDoApp()}/nomanduz` };
    try {
      await sendTemplateEmail("nova-solicitacao", emailNomanduz(), {
        templateData: dados,
        replyTo: data.email,
      });
    } catch (e) {
      console.error("email nova-solicitacao", e);
    }
    try {
      await sendTemplateEmail("solicitacao-recebida", data.email, {
        templateData: dados,
        replyTo: emailNomanduz(),
      });
    } catch (e) {
      console.error("email solicitacao-recebida", e);
    }
    return { ok: true };
  });

async function solicitacaoPorCodigo(codigo: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = await import("./seguranca.server");
  const { ipDaRequisicao } = await import("./requisicao.server");
  const ip = ipDaRequisicao();
  await s.exigirAbaixoDoLimite(supabaseAdmin, `ativacao-ip:${ip}`, 10, 15);
  const limpo = s.normalizarCodigo(codigo);
  const { data: sol } =
    limpo.length === 12
      ? await supabaseAdmin
          .from("solicitacoes_cadastro")
          .select("*")
          .eq("codigo_hash", s.sha256(limpo))
          .maybeSingle()
      : { data: null };
  if (
    !sol ||
    sol.status !== "aprovada" ||
    !sol.codigo_expira_em ||
    Date.parse(sol.codigo_expira_em) < Date.now()
  ) {
    await s.registrarTentativa(supabaseAdmin, `ativacao-ip:${ip}`);
    throw new Error("Código de ativação inválido ou expirado. Peça um novo à equipe PontoFlex.");
  }
  return { supabaseAdmin, sol };
}

export const consultarAtivacao = createServerFn({ method: "POST" })
  .validator((d: { codigo: string }) => d)
  .handler(async ({ data }) => {
    const { sol } = await solicitacaoPorCodigo(data.codigo);
    return {
      razao_social: sol.razao_social as string,
      documento: sol.documento as string,
      tipo_documento: sol.tipo_documento as "CPF" | "CNPJ",
      responsavel: sol.responsavel as string,
      email: sol.email as string,
      diasTeste: DIAS_TESTE,
    };
  });

export const ativarConta = createServerFn({ method: "POST" })
  .validator((d: { codigo: string; senha: string; aceite: boolean }) => {
    const erro = validarSenhaEmpresa(d?.senha ?? "");
    if (erro) throw new Error(erro);
    if (d.aceite !== true) throw new Error("É preciso aceitar os termos de uso");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin, sol } = await solicitacaoPorCodigo(data.codigo);
    const { data: existe } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("documento", sol.documento)
      .maybeSingle();
    if (existe) throw new Error("Esta empresa já foi ativada. Entre pela página de login.");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: empresaEmail(sol.documento),
      password: data.senha,
      email_confirm: true,
    });
    if (error || !criado.user)
      throw new Error("Não foi possível criar o acesso. Fale com a equipe PontoFlex.");
    const uid = criado.user.id;
    const desfazer = async () => {
      await supabaseAdmin.auth.admin.deleteUser(uid);
    };

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert({
        documento: sol.documento,
        tipo_documento: sol.tipo_documento,
        razao_social: sol.razao_social,
        responsavel: sol.responsavel,
        email: sol.email,
        telefone: sol.telefone,
        user_id: uid,
        status: "teste",
        teste_ate: new Date(Date.now() + DIAS_TESTE * 864e5).toISOString(),
      })
      .select("id")
      .single();
    if (empErr || !emp) {
      await desfazer();
      throw new Error("Não foi possível criar a empresa. Fale com a equipe PontoFlex.");
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "admin" });
    if (roleErr) {
      await supabaseAdmin.from("empresas").delete().eq("id", emp.id);
      await desfazer();
      throw new Error("Não foi possível criar a empresa. Fale com a equipe PontoFlex.");
    }
    await supabaseAdmin
      .from("solicitacoes_cadastro")
      .update({
        status: "ativada",
        empresa_id: emp.id,
        codigo_hash: null,
        ativado_em: new Date().toISOString(),
      })
      .eq("id", sol.id);
    return { ok: true, documento: sol.documento as string };
  });

export const VALIDADE_CODIGO_MS = VALIDADE_CODIGO_DIAS * 864e5;
