import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CODIGO_VALIDADE_MIN = 15;
const MAX_TENTATIVAS = 5;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function minhaEmpresa(supabase: any, userId: string) {
  const { data } = await supabase.from("empresas").select("id, email, razao_social").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Apenas a empresa pode trocar esta senha");
  return data as { id: string; email: string | null; razao_social: string | null };
}

function mascararEmail(e: string) {
  const [u = "", d = ""] = e.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

export const pedirCodigoSenhaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const emp = await minhaEmpresa(context.supabase, context.userId);
    if (!emp.email) throw new Error("A empresa não tem e-mail cadastrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin.from("codigos_senha_empresa").select("id", { count: "exact", head: true }).eq("empresa_id", emp.id).gte("created_at", desde);
    if ((count ?? 0) > 0) throw new Error("Aguarde um minuto antes de pedir outro código");

    const rnd = new Uint32Array(1);
    crypto.getRandomValues(rnd);
    const codigo = String(rnd[0]! % 1_000_000).padStart(6, "0");
    await supabaseAdmin.from("codigos_senha_empresa").update({ usado: true }).eq("empresa_id", emp.id).eq("usado", false);
    const { data: row, error } = await supabaseAdmin.from("codigos_senha_empresa").insert({
      empresa_id: emp.id,
      codigo_hash: await sha256(`${emp.id}:${codigo}`),
      expira_em: new Date(Date.now() + CODIGO_VALIDADE_MIN * 60_000).toISOString(),
    }).select("id").single();
    if (error || !row) throw new Error("Não foi possível gerar o código");

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("codigo-senha-empresa", emp.email, {
        templateData: { codigo, empresa: emp.razao_social ?? undefined },
        idempotencyKey: `codigo-senha-empresa-${row.id}`,
      });
      if (!r.sent) throw new Error("O e-mail da empresa está bloqueado para envio");
    } catch (e) {
      console.error("envio codigo senha", e);
      throw new Error(e instanceof Error && e.message.includes("bloqueado") ? e.message : "Não foi possível enviar o e-mail agora. Tente novamente mais tarde.");
    }
    return { ok: true, email: mascararEmail(emp.email) };
  });

export const trocarSenhaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { atual: string; nova: string; codigo: string }) => {
    if (!d?.atual) throw new Error("Informe a senha atual");
    if (!/^\d{6}$/.test(d.codigo ?? "")) throw new Error("Informe o código de 6 números");
    const n = d.nova ?? "";
    if (n.length < 12 || !/[a-z]/.test(n) || !/[A-Z]/.test(n) || !/\d/.test(n) || !/[^a-zA-Z0-9]/.test(n))
      throw new Error("A nova senha precisa de 12+ caracteres, com maiúscula, minúscula, número e símbolo");
    if (d.atual === n) throw new Error("A nova senha deve ser diferente da atual");
    return d;
  })
  .handler(async ({ data, context }) => {
    const emp = await minhaEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("codigos_senha_empresa").select("*").eq("empresa_id", emp.id).eq("usado", false).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!c || Date.parse(c.expira_em) < Date.now()) throw new Error("Código expirado. Peça um novo código.");
    if (c.tentativas >= MAX_TENTATIVAS) throw new Error("Muitas tentativas. Peça um novo código.");
    if ((await sha256(`${emp.id}:${data.codigo}`)) !== c.codigo_hash) {
      await supabaseAdmin.from("codigos_senha_empresa").update({ tentativas: c.tentativas + 1 }).eq("id", c.id);
      throw new Error("Código incorreto");
    }
    const email = context.claims.email as string;
    const { error: e1 } = await supabaseAdmin.auth.signInWithPassword({ email, password: data.atual });
    if (e1) throw new Error("Senha atual incorreta");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.nova });
    if (error) throw new Error("Não foi possível trocar a senha");
    await supabaseAdmin.from("codigos_senha_empresa").update({ usado: true }).eq("id", c.id);
    return { ok: true };
  });
