// "Esqueci minha senha" da empresa: pedido público, conferência do código e troca da senha.
import { createServerFn } from "@tanstack/react-start";
import { digits, maskDocumento } from "./doc";
import { validarSenhaEmpresa } from "./cadastro.functions";

const INVALIDO = "Link inválido, expirado ou já utilizado. Peça um novo em “Esqueci minha senha”.";

/**
 * A resposta é sempre a mesma, exista ou não a empresa: assim ninguém descobre quais CPFs/CNPJs
 * usam o PontoFlex.
 */
export const pedirRedefinicaoSenha = createServerFn({ method: "POST" })
  .validator((d: { documento: string }) => {
    const doc = digits(d?.documento ?? "");
    if (doc.length !== 11 && doc.length !== 14) throw new Error("Informe o CPF ou CNPJ da empresa");
    return { documento: doc };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await import("./seguranca.server");
    const { ipDaRequisicao } = await import("./requisicao.server");
    const chaves = [`redefinir-ip:${ipDaRequisicao()}`, `redefinir-doc:${data.documento}`];
    await s.exigirAbaixoDoLimite(supabaseAdmin, chaves[0]!, 5, 60);
    await s.exigirAbaixoDoLimite(
      supabaseAdmin,
      chaves[1]!,
      3,
      60,
      "Já enviamos alguns links para esta empresa. Confira o e-mail ou tente mais tarde.",
    );
    for (const c of chaves) await s.registrarTentativa(supabaseAdmin, c);

    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, razao_social, responsavel, email")
      .eq("documento", maskDocumento(data.documento))
      .maybeSingle();
    if (emp?.email) {
      const { criarRedefinicao } = await import("./redefinir.server");
      await criarRedefinicao(supabaseAdmin, emp, "email");
    }
    return { ok: true };
  });

export const consultarRedefinicao = createServerFn({ method: "POST" })
  .validator((d: { codigo: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await import("./seguranca.server");
    const { ipDaRequisicao } = await import("./requisicao.server");
    const chave = `redefinir-codigo:${ipDaRequisicao()}`;
    await s.exigirAbaixoDoLimite(supabaseAdmin, chave, 10, 15);
    const { redefinicaoPorCodigo } = await import("./redefinir.server");
    const r = await redefinicaoPorCodigo(supabaseAdmin, data?.codigo ?? "");
    if (!r) {
      await s.registrarTentativa(supabaseAdmin, chave);
      throw new Error(INVALIDO);
    }
    return {
      razao_social: r.emp.razao_social as string,
      documento: r.emp.documento as string,
      tipo_documento: r.emp.tipo_documento as string,
    };
  });

export const redefinirSenhaEmpresa = createServerFn({ method: "POST" })
  .validator((d: { codigo: string; senha: string }) => {
    const erro = validarSenhaEmpresa(d?.senha ?? "");
    if (erro) throw new Error(erro);
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await import("./seguranca.server");
    const { ipDaRequisicao } = await import("./requisicao.server");
    const chave = `redefinir-codigo:${ipDaRequisicao()}`;
    await s.exigirAbaixoDoLimite(supabaseAdmin, chave, 10, 15);
    const { redefinicaoPorCodigo } = await import("./redefinir.server");
    const r = await redefinicaoPorCodigo(supabaseAdmin, data.codigo);
    if (!r) {
      await s.registrarTentativa(supabaseAdmin, chave);
      throw new Error(INVALIDO);
    }
    // Marca como usado antes de trocar: dois envios simultâneos não usam o mesmo link.
    const { data: marcado } = await supabaseAdmin
      .from("redefinicoes_senha")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", r.pedido.id)
      .is("usado_em", null)
      .select("id");
    if (!marcado?.length) throw new Error(INVALIDO);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(r.emp.user_id as string, {
      password: data.senha,
    });
    if (error) {
      await supabaseAdmin
        .from("redefinicoes_senha")
        .update({ usado_em: null })
        .eq("id", r.pedido.id);
      throw new Error("Não foi possível trocar a senha. Tente novamente.");
    }
    return { ok: true, documento: r.emp.documento as string };
  });
