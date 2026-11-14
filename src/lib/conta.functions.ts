import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIPOS, type Tipo } from "./ponto";
import { podeTrocarSenha, validarNovaSenha } from "./senha";

async function meuFuncionario(supabase: any, userId: string) {
  const { data } = await supabase.from("funcionarios").select("id, empresa_id, ativo, senha_alterada_em").eq("user_id", userId).maybeSingle();
  if (!data || !data.ativo) throw new Error("Acesso de funcionário não encontrado ou desativado");
  return data as { id: string; empresa_id: string; senha_alterada_em: string | null };
}

export const trocarMinhaSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { atual: string; nova: string }) => {
    const erro = validarNovaSenha(d?.nova ?? "");
    if (erro) throw new Error(erro);
    if (!d.atual) throw new Error("Informe a senha atual");
    if (d.atual === d.nova) throw new Error("A nova senha deve ser diferente da atual");
    return d;
  })
  .handler(async ({ data, context }) => {
    const f = await meuFuncionario(context.supabase, context.userId);
    if (!podeTrocarSenha(f.senha_alterada_em)) throw new Error("Você já trocou sua senha este mês. Tente novamente no próximo mês.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = context.claims.email as string;
    const { error: e1 } = await supabaseAdmin.auth.signInWithPassword({ email, password: data.atual });
    if (e1) throw new Error("Senha atual incorreta");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.nova });
    if (error) throw new Error("Não foi possível trocar a senha");
    await supabaseAdmin.from("funcionarios").update({ senha_alterada_em: new Date().toISOString() }).eq("id", f.id);
    return { ok: true };
  });

export const solicitarAjuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tipo: Tipo; data_hora: string; motivo: string; latitude: number; longitude: number }) => {
    if (!TIPOS.includes(d?.tipo)) throw new Error("Tipo inválido");
    const t = Date.parse(d.data_hora);
    if (!Number.isFinite(t) || t > Date.now()) throw new Error("Informe um horário que já passou");
    if (Date.now() - t > 45 * 864e5) throw new Error("Só é possível solicitar marcações dos últimos 45 dias");
    if ((d.motivo ?? "").trim().length < 5) throw new Error("Explique o motivo da solicitação");
    if (!Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) throw new Error("Localização obrigatória");
    return { ...d, motivo: d.motivo.trim().slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const f = await meuFuncionario(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("solicitacoes_ponto").insert({
      empresa_id: f.empresa_id,
      funcionario_id: f.id,
      tipo: data.tipo,
      data_hora: new Date(data.data_hora).toISOString(),
      motivo: data.motivo,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    if (error) throw new Error("Não foi possível enviar a solicitação");
    return { ok: true };
  });

export const analisarSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; aprovar: boolean; observacao?: string }) => d)
  .handler(async ({ data, context }) => {
    // RLS: admin only sees requests of their own empresa; employees can't reach other empresas'
    const { data: s } = await context.supabase.from("solicitacoes_ponto").select("*").eq("id", data.id).maybeSingle();
    const { data: empresaId } = await context.supabase.rpc("my_empresa_id");
    if (!s || s.empresa_id !== empresaId) throw new Error("Solicitação não encontrada");
    if (s.status !== "pendente") throw new Error("Solicitação já analisada");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.aprovar) {
      const { error } = await supabaseAdmin.from("pontos").insert({
        funcionario_id: s.funcionario_id,
        empresa_id: s.empresa_id,
        tipo: s.tipo,
        data_hora: s.data_hora,
        latitude: s.latitude,
        longitude: s.longitude,
        origem: "ajuste",
        solicitacao_id: s.id,
        face_status: "ajuste",
      });
      if (error) throw new Error("Não foi possível lançar a marcação");
    }
    await supabaseAdmin
      .from("solicitacoes_ponto")
      .update({ status: data.aprovar ? "aprovado" : "recusado", observacao: data.observacao?.slice(0, 500) ?? null, analisado_em: new Date().toISOString() })
      .eq("id", s.id);
    return { ok: true };
  });
