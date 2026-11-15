// Somente servidor: links de uso único para redefinir a senha da empresa.
import type { Banco } from "@/integrations/supabase/banco";

export const VALIDADE_EMAIL_MS = 60 * 60_000; // pedido pela própria empresa: 1 hora
export const VALIDADE_NOMANDUZ_MS = 24 * 3600_000; // link gerado pela equipe: 24 horas

type Empresa = {
  id: string;
  razao_social: string;
  responsavel: string | null;
  email: string | null;
};

/** Gera o código, invalida os anteriores e tenta mandar por e-mail. */
export async function criarRedefinicao(
  admin: Banco,
  emp: Empresa,
  origem: "email" | "nomanduz",
): Promise<{ codigo: string; link: string; emailEnviado: boolean; expiraEm: string }> {
  const { gerarCodigoAtivacao, normalizarCodigo, sha256 } = await import("./seguranca.server");
  const { urlDoApp } = await import("./requisicao.server");
  const codigo = gerarCodigoAtivacao();
  const validade = origem === "email" ? VALIDADE_EMAIL_MS : VALIDADE_NOMANDUZ_MS;
  const expiraEm = new Date(Date.now() + validade).toISOString();

  // Só o link mais recente vale.
  await admin.from("redefinicoes_senha").delete().eq("empresa_id", emp.id).is("usado_em", null);
  const { error } = await admin.from("redefinicoes_senha").insert({
    empresa_id: emp.id,
    codigo_hash: sha256(normalizarCodigo(codigo)),
    expira_em: expiraEm,
    origem,
  });
  if (error) throw new Error("Não foi possível gerar o link de redefinição");

  const link = `${urlDoApp()}/redefinir?codigo=${normalizarCodigo(codigo)}`;
  let emailEnviado = false;
  if (emp.email) {
    try {
      const { sendTemplateEmail, emailNomanduz } = await import("./email-templates/send-email");
      const r = await sendTemplateEmail("redefinir-senha", emp.email, {
        templateData: {
          razao_social: emp.razao_social,
          responsavel: emp.responsavel,
          link,
          codigo,
          validade: origem === "email" ? "1 hora" : "24 horas",
        },
        replyTo: emailNomanduz(),
      });
      emailEnviado = r.sent;
    } catch (e) {
      console.error("email redefinir-senha", e);
    }
  }
  return { codigo, link, emailEnviado, expiraEm };
}

/** Localiza um pedido válido (não usado, dentro do prazo) pelo código. */
export async function redefinicaoPorCodigo(admin: Banco, codigo: string) {
  const { normalizarCodigo, sha256 } = await import("./seguranca.server");
  const limpo = normalizarCodigo(codigo);
  if (limpo.length !== 12) return null;
  const { data: r } = await admin
    .from("redefinicoes_senha")
    .select("id, empresa_id, expira_em, usado_em")
    .eq("codigo_hash", sha256(limpo))
    .maybeSingle();
  if (!r || r.usado_em || Date.parse(r.expira_em) < Date.now()) return null;
  const { data: emp } = await admin
    .from("empresas")
    .select("id, razao_social, documento, tipo_documento, user_id")
    .eq("id", r.empresa_id)
    .maybeSingle();
  return emp ? { pedido: r, emp } : null;
}
