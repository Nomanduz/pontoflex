import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayKey } from "./ponto";
import { montarFolha, periodoDe, type EscalaCfg } from "./escala";

export const fecharPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inicio: string }) => {
    if (!/^\d{4}-\d{2}-21$/.test(d?.inicio ?? "")) throw new Error("Período inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: empresa } = await context.supabase.from("empresas").select("id, razao_social, cnpj").eq("user_id", context.userId).maybeSingle();
    if (!empresa) throw new Error("Apenas o administrador pode fechar o ponto");
    const { inicio, fim } = periodoDe(data.inicio);
    if (fim >= dayKey(new Date())) throw new Error("O período só pode ser fechado após o dia 20");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256 } = await import("./face.server");
    const { data: funcs } = await context.supabase.from("funcionarios").select("*").eq("empresa_id", empresa.id);
    const { data: existentes } = await supabaseAdmin.from("fechamentos").select("funcionario_id, func_assinado_em").eq("empresa_id", empresa.id).eq("periodo_inicio", inicio);
    const assinados = new Set((existentes ?? []).filter((e) => e.func_assinado_em).map((e) => e.funcionario_id));

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
        empresa: { razao_social: empresa.razao_social, cnpj: empresa.cnpj },
        funcionario: { nome: f.nome, cpf: f.cpf, cargo: f.cargo, matricula: f.matricula },
        escala: { escala: f.escala, hora_entrada: f.hora_entrada, hora_saida_almoco: f.hora_saida_almoco, hora_retorno_almoco: f.hora_retorno_almoco, hora_saida: f.hora_saida },
        folha,
      };
      const hash = await sha256(JSON.stringify(resumo));
      const { error } = await supabaseAdmin
        .from("fechamentos")
        .upsert({ empresa_id: empresa.id, funcionario_id: f.id, periodo_inicio: inicio, periodo_fim: fim, resumo: JSON.parse(JSON.stringify(resumo)), hash, fechado_em: new Date().toISOString() }, { onConflict: "funcionario_id,periodo_inicio" });
      if (!error) fechados++;
    }
    return { fechados };
  });

export const assinarFolha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; senha: string; latitude?: number | null; longitude?: number | null }) => {
    if (!d?.id || !d.senha) throw new Error("Informe sua senha para assinar");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: fc } = await context.supabase
      .from("fechamentos")
      .select("id, func_assinado_em, empresa_assinado_em, funcionarios!inner(user_id), empresas!inner(user_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!fc) throw new Error("Folha não encontrada");
    const souFunc = (fc.funcionarios as { user_id: string | null }).user_id === context.userId;
    const souEmpresa = (fc.empresas as { user_id: string }).user_id === context.userId;

    // Re-authenticate with the password: the electronic signature is the user's credential
    const email = context.claims.email as string | undefined;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const verifier = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error: authErr } = await verifier.auth.signInWithPassword({ email: email ?? "", password: data.senha });
    if (authErr) throw new Error("Senha incorreta");

    const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (souFunc) {
      if (fc.func_assinado_em) throw new Error("Você já assinou esta folha");
      await supabaseAdmin.from("fechamentos").update({ func_assinado_em: now, func_ip: ip, func_latitude: data.latitude ?? null, func_longitude: data.longitude ?? null }).eq("id", fc.id);
    } else if (souEmpresa) {
      if (!fc.func_assinado_em) throw new Error("Aguardando a assinatura do funcionário");
      if (fc.empresa_assinado_em) throw new Error("A empresa já assinou esta folha");
      await supabaseAdmin.from("fechamentos").update({ empresa_assinado_em: now, empresa_ip: ip }).eq("id", fc.id);
    } else throw new Error("Sem permissão");
    return { ok: true };
  });
