import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { digits, funcionarioEmail, maskCpf } from "./doc";

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
  matricula?: string;
};

export const createFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NovoFuncionario) => {
    if (!d.nome?.trim()) throw new Error("Nome é obrigatório");
    if (digits(d.cpf ?? "").length !== 11) throw new Error("CPF inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: empresa } = await context.supabase
      .from("empresas")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!empresa) throw new Error("Apenas o administrador pode cadastrar funcionários");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cpf = maskCpf(data.cpf);
    const { data: existing } = await supabaseAdmin.from("funcionarios").select("id").eq("cpf", cpf).maybeSingle();
    if (existing) throw new Error("Já existe um funcionário com este CPF");

    const senha = gerarSenha();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: funcionarioEmail(cpf),
      password: senha,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error("Não foi possível criar o acesso do funcionário");
    const uid = created.user.id;

    const { data: novo, error: insErr } = await supabaseAdmin.from("funcionarios").insert({
      empresa_id: empresa.id,
      user_id: uid,
      nome: data.nome.trim(),
      cpf,
      telefone: data.telefone || null,
      cargo: data.cargo || null,
      matricula: data.matricula || null,
    }).select("id").single();
    if (insErr || !novo) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      throw new Error("Não foi possível salvar o funcionário");
    }
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "funcionario" });
    return { ok: true, id: novo.id, senha };
  });

export const deleteFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    // RLS limits this read to funcionários of the caller's own empresa
    const { data: f } = await context.supabase
      .from("funcionarios")
      .select("id, user_id, empresa_id, empresas!inner(user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!f || (f.empresas as { user_id: string }).user_id !== context.userId)
      throw new Error("Funcionário não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("funcionarios").delete().eq("id", f.id);
    if (f.user_id) await supabaseAdmin.auth.admin.deleteUser(f.user_id);
    return { ok: true };
  });

export const resetSenhaFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase
      .from("funcionarios")
      .select("user_id, empresas!inner(user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!f?.user_id || (f.empresas as { user_id: string }).user_id !== context.userId)
      throw new Error("Funcionário não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha = gerarSenha();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(f.user_id, { password: senha });
    if (error) throw new Error("Não foi possível gerar a nova senha");
    return { ok: true, senha };
  });
