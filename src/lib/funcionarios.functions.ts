import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cpfValido, funcionarioEmail, maskCpf } from "./doc";

/** Auto-generated alphanumeric password (no ambiguous chars), shown to the admin once. */
export function gerarSenha(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const rnd = new Uint32Array(len);
  crypto.getRandomValues(rnd);
  return [...rnd].map((n) => chars[n % chars.length]).join("");
}

type NovoFuncionario = {
  nome: string;
  cpf: string;
  telefone?: string;
  cargo?: string;
  matricula: string;
};

async function minhaEmpresa(context: { userId: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!empresa) throw new Error("Apenas o administrador da empresa pode fazer isso");
  return { supabaseAdmin, empresa: empresa as { id: string } };
}

export const createFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: NovoFuncionario) => {
    if (!d?.nome?.trim()) throw new Error("Nome é obrigatório");
    if (!cpfValido(d.cpf ?? "")) throw new Error("CPF inválido");
    if (!d.matricula?.trim())
      throw new Error("Matrícula é obrigatória (o funcionário usa para entrar)");
    if (d.matricula.trim().length > 50) throw new Error("Matrícula muito longa");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const cpf = maskCpf(data.cpf);
    const matricula = data.matricula.trim();
    const { data: mesmos } = await supabaseAdmin
      .from("funcionarios")
      .select("cpf, matricula")
      .eq("empresa_id", empresa.id);
    if ((mesmos ?? []).some((m: { cpf: string }) => m.cpf === cpf))
      throw new Error("Já existe um funcionário com este CPF na empresa");
    if (
      (mesmos ?? []).some(
        (m: { matricula: string }) => m.matricula.toLowerCase() === matricula.toLowerCase(),
      )
    )
      throw new Error("Esta matrícula já está em uso na empresa");

    const senha = gerarSenha();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: funcionarioEmail(empresa.id, cpf),
      password: senha,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error("Não foi possível criar o acesso do funcionário");
    const uid = created.user.id;

    const { data: novo, error: insErr } = await supabaseAdmin
      .from("funcionarios")
      .insert({
        empresa_id: empresa.id,
        user_id: uid,
        nome: data.nome.trim(),
        cpf,
        telefone: data.telefone || null,
        cargo: data.cargo || null,
        matricula,
      })
      .select("id")
      .single();
    if (insErr || !novo) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Não foi possível salvar o funcionário");
    }
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "funcionario" });
    if (roleErr) {
      await supabaseAdmin.from("funcionarios").delete().eq("id", novo.id);
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Não foi possível salvar o funcionário");
    }
    return { ok: true, id: novo.id, senha };
  });

/** Desativar mantém todo o histórico (exigência legal) e bloqueia o acesso. */
export const alterarAtivoFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; ativo: boolean }) => {
    if (!d?.id || typeof d.ativo !== "boolean") throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, user_id")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f) throw new Error("Funcionário não encontrado");
    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({ ativo: data.ativo, desativado_em: data.ativo ? null : new Date().toISOString() })
      .eq("id", f.id);
    if (error) throw new Error("Não foi possível alterar o funcionário");
    if (f.user_id)
      await supabaseAdmin.auth.admin.updateUserById(f.user_id, {
        ban_duration: data.ativo ? "none" : "876000h",
      });
    return { ok: true };
  });

/** Exclusão definitiva só para cadastro feito por engano (sem marcações, folhas ou solicitações). */
export const deleteFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, user_id, face_id, empresa_id")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f) throw new Error("Funcionário não encontrado");
    for (const tabela of ["pontos", "fechamentos", "solicitacoes_ponto"] as const) {
      const { count } = await supabaseAdmin
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("funcionario_id", f.id);
      if ((count ?? 0) > 0)
        throw new Error(
          'Este funcionário já tem registros de ponto e não pode ser excluído (a lei exige guardar o histórico). Use "Desativar".',
        );
    }
    if (f.face_id) {
      const { removerRosto } = await import("./face.server");
      await removerRosto(f.empresa_id, [f.face_id]);
    }
    const { data: arquivos } = await supabaseAdmin.storage
      .from("faces")
      .list(`${f.empresa_id}/${f.id}`);
    if (arquivos?.length)
      await supabaseAdmin.storage
        .from("faces")
        .remove(arquivos.map((a: { name: string }) => `${f.empresa_id}/${f.id}/${a.name}`));
    const { error } = await supabaseAdmin.from("funcionarios").delete().eq("id", f.id);
    if (error) throw new Error("Não foi possível excluir o funcionário");
    if (f.user_id) await supabaseAdmin.auth.admin.deleteUser(f.user_id);
    return { ok: true };
  });

export const resetSenhaFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("user_id")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f?.user_id) throw new Error("Funcionário não encontrado");
    const senha = gerarSenha();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(f.user_id, { password: senha });
    if (error) throw new Error("Não foi possível gerar a nova senha");
    return { ok: true, senha };
  });
