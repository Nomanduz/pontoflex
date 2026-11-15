import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cpfValido, funcionarioEmail, maskCpf } from "./doc";
import * as vinculo from "./vinculo";

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
      .select("id, user_id, data_desligamento")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f) throw new Error("Funcionário não encontrado");
    if (data.ativo && f.data_desligamento)
      throw new Error("Funcionário desligado: para reativar, desfaça o desligamento na ficha dele");
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
    for (const tabela of [
      "pontos",
      "fechamentos",
      "solicitacoes_ponto",
      "afastamentos",
      "ferias",
    ] as const) {
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

type Desligamento = {
  id: string;
  data: string;
  motivo: string;
  aviso: string;
  obs?: string;
};

/**
 * Registra o desligamento (demissão, pedido, término de contrato…): bloqueia o acesso e apaga a
 * biometria facial, que deixa de ter finalidade (LGPD art. 15 e 16). As marcações de ponto e as
 * folhas ficam guardadas, porque a lei exige.
 */
export const desligarFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Desligamento) => {
    const { MOTIVOS_DESLIGAMENTO, AVISOS_PREVIOS } = vinculo;
    if (!d?.id || !/^\d{4}-\d{2}-\d{2}$/.test(d.data ?? ""))
      throw new Error("Informe a data do desligamento");
    if (!(d.motivo in MOTIVOS_DESLIGAMENTO)) throw new Error("Escolha o motivo do desligamento");
    if (!(d.aviso in AVISOS_PREVIOS)) throw new Error("Informe o aviso prévio");
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    if (d.data > hoje)
      throw new Error(
        "Registre o desligamento no último dia de trabalho (até lá a pessoa ainda precisa bater o ponto).",
      );
    return { ...d, obs: d.obs?.trim().slice(0, 500) || null };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, user_id, face_id, foto_path, data_admissao, data_desligamento")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f) throw new Error("Funcionário não encontrado");
    if (f.data_desligamento) throw new Error("Este funcionário já está desligado");
    if (f.data_admissao && data.data < f.data_admissao)
      throw new Error("O desligamento não pode ser antes da admissão");

    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({
        data_desligamento: data.data,
        motivo_desligamento: data.motivo,
        aviso_previo: data.aviso,
        desligamento_obs: data.obs,
        ativo: false,
        desativado_em: new Date().toISOString(),
        face_id: null,
        foto_path: null,
        foto_status: "sem_foto",
      })
      .eq("id", f.id);
    if (error) throw new Error("Não foi possível registrar o desligamento");
    if (f.user_id)
      await supabaseAdmin.auth.admin.updateUserById(f.user_id, { ban_duration: "876000h" });
    if (f.face_id) {
      const { removerRosto } = await import("./face.server");
      await removerRosto(empresa.id, [f.face_id]);
    }
    if (f.foto_path) await supabaseAdmin.storage.from("faces").remove([f.foto_path]);
    return { ok: true };
  });

/** Desfaz um desligamento lançado por engano. O rosto precisa ser cadastrado de novo. */
export const desfazerDesligamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, empresa } = await minhaEmpresa(context);
    const { data: f } = await supabaseAdmin
      .from("funcionarios")
      .select("id, user_id, data_desligamento")
      .eq("id", data.id)
      .eq("empresa_id", empresa.id)
      .maybeSingle();
    if (!f?.data_desligamento) throw new Error("Funcionário não está desligado");
    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({
        data_desligamento: null,
        motivo_desligamento: null,
        aviso_previo: null,
        desligamento_obs: null,
        ativo: true,
        desativado_em: null,
      })
      .eq("id", f.id);
    if (error) throw new Error("Não foi possível desfazer o desligamento");
    if (f.user_id)
      await supabaseAdmin.auth.admin.updateUserById(f.user_id, { ban_duration: "none" });
    return { ok: true };
  });
