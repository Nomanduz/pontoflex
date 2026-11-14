import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayKey } from "./ponto";
import { montarFolha, periodoDe, type EscalaCfg } from "./escala";

export const fecharPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { inicio: string }) => {
    if (!/^\d{4}-\d{2}-21$/.test(d?.inicio ?? "")) throw new Error("Período inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: empresa } = await context.supabase
      .from("empresas")
      .select("id, razao_social, documento, tipo_documento")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!empresa) throw new Error("Apenas o administrador pode fechar o ponto");
    const { inicio, fim } = periodoDe(data.inicio);
    if (fim >= dayKey(new Date())) throw new Error("O período só pode ser fechado após o dia 20");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256 } = await import("./seguranca.server");
    const { data: funcs } = await context.supabase
      .from("funcionarios")
      .select("*")
      .eq("empresa_id", empresa.id);
    const { data: existentes } = await supabaseAdmin
      .from("fechamentos")
      .select("funcionario_id, func_assinado_em")
      .eq("empresa_id", empresa.id)
      .eq("periodo_inicio", inicio);
    const assinados = new Set(
      (existentes ?? []).filter((e) => e.func_assinado_em).map((e) => e.funcionario_id),
    );

    // Shifts starting on the last day may end the next morning
    const ate = new Date(Date.parse(`${fim}T00:00:00-03:00`) + 2 * 864e5).toISOString();
    let fechados = 0;
    for (const f of funcs ?? []) {
      if (assinados.has(f.id)) continue;
      const { data: pts } = await context.supabase
        .from("pontos")
        .select("tipo, data_hora, latitude, longitude")
        .eq("funcionario_id", f.id)
        .gte("data_hora", `${inicio}T00:00:00-03:00`)
        .lt("data_hora", ate)
        .order("data_hora");
      const folha = montarFolha(f as EscalaCfg, pts ?? [], inicio, fim);
      const resumo = {
        empresa: {
          razao_social: empresa.razao_social,
          documento: empresa.documento,
          tipo_documento: empresa.tipo_documento,
        },
        funcionario: { nome: f.nome, cpf: f.cpf, cargo: f.cargo, matricula: f.matricula },
        escala: {
          escala: f.escala,
          hora_entrada: f.hora_entrada,
          hora_saida_almoco: f.hora_saida_almoco,
          hora_retorno_almoco: f.hora_retorno_almoco,
          hora_saida: f.hora_saida,
        },
        folha,
      };
      const hash = sha256(JSON.stringify(resumo));
      const { error } = await supabaseAdmin.from("fechamentos").upsert(
        {
          empresa_id: empresa.id,
          funcionario_id: f.id,
          periodo_inicio: inicio,
          periodo_fim: fim,
          resumo: JSON.parse(JSON.stringify(resumo)),
          hash,
          fechado_em: new Date().toISOString(),
        },
        { onConflict: "funcionario_id,periodo_inicio" },
      );
      if (!error) fechados++;
    }
    return { fechados };
  });

export const assinarFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (d: {
      id: string;
      senha: string;
      hash: string;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
      if (!d?.id || !d.senha) throw new Error("Informe sua senha para assinar");
      if (!d.hash) throw new Error("Confira a folha antes de assinar");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: fc } = await context.supabase
      .from("fechamentos")
      .select(
        "id, hash, func_assinado_em, empresa_assinado_em, funcionarios!inner(user_id), empresas!inner(user_id)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!fc) throw new Error("Folha não encontrada");
    const souFunc = (fc.funcionarios as { user_id: string | null }).user_id === context.userId;
    const souEmpresa = (fc.empresas as { user_id: string }).user_id === context.userId;

    if (fc.hash !== data.hash)
      throw new Error(
        "A folha foi atualizada depois que você abriu. Confira novamente antes de assinar.",
      );

    // A assinatura eletrônica é a própria credencial: reconfirma a senha (cliente descartável).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { exigirAbaixoDoLimite, registrarTentativa } = await import("./seguranca.server");
    await exigirAbaixoDoLimite(supabaseAdmin, `assinatura:${context.userId}`, 5, 15);
    const { senhaConfere } = await import("@/integrations/supabase/auth-check.server");
    if (!(await senhaConfere((context.claims.email as string | undefined) ?? "", data.senha))) {
      await registrarTentativa(supabaseAdmin, `assinatura:${context.userId}`);
      throw new Error("Senha incorreta");
    }

    const ip =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    const now = new Date().toISOString();
    if (souFunc) {
      if (fc.func_assinado_em) throw new Error("Você já assinou esta folha");
      const { data: ok } = await supabaseAdmin
        .from("fechamentos")
        .update({
          func_assinado_em: now,
          func_hash_assinado: fc.hash,
          func_ip: ip,
          func_latitude: data.latitude ?? null,
          func_longitude: data.longitude ?? null,
        })
        .eq("id", fc.id)
        .eq("hash", fc.hash)
        .is("func_assinado_em", null)
        .select("id");
      if (!ok?.length) throw new Error("A folha mudou ou já foi assinada. Confira novamente.");
    } else if (souEmpresa) {
      if (!fc.func_assinado_em) throw new Error("Aguardando a assinatura do funcionário");
      if (fc.empresa_assinado_em) throw new Error("A empresa já assinou esta folha");
      const { data: ok } = await supabaseAdmin
        .from("fechamentos")
        .update({ empresa_assinado_em: now, empresa_hash_assinado: fc.hash, empresa_ip: ip })
        .eq("id", fc.id)
        .eq("hash", fc.hash)
        .is("empresa_assinado_em", null)
        .select("id");
      if (!ok?.length) throw new Error("A folha mudou ou já foi assinada. Confira novamente.");
    } else throw new Error("Sem permissão");
    return { ok: true };
  });
