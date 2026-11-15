// Autoatendimento do funcionário (perfil, foto, atestados, ciência de férias) e análise pela empresa.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function meuCadastro(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("funcionarios")
    .select("id, empresa_id, ativo, foto_perfil_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.ativo) throw new Error("Acesso de funcionário não encontrado ou desativado");
  return { supabaseAdmin, f: data };
}

const limpo = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

const ARQUIVOS: Record<string, string> = {
  "data:image/jpeg;base64,": "jpg",
  "data:image/png;base64,": "png",
  "data:application/pdf;base64,": "pdf",
};
function lerArquivo(dataUrl: unknown, maxBytes: number, tipos = Object.keys(ARQUIVOS)) {
  if (typeof dataUrl !== "string") throw new Error("Arquivo inválido");
  const prefixo = tipos.find((p) => dataUrl.startsWith(p));
  if (!prefixo) throw new Error("Envie uma foto (JPG/PNG) ou um PDF");
  const bytes = new Uint8Array(Buffer.from(dataUrl.slice(prefixo.length), "base64"));
  if (!bytes.length) throw new Error("Arquivo vazio");
  if (bytes.length > maxBytes)
    throw new Error(`Arquivo muito grande (máximo ${Math.round(maxBytes / 1_000_000)} MB)`);
  return {
    bytes,
    ext: ARQUIVOS[prefixo]!,
    mime: prefixo.slice(5, prefixo.indexOf(";")),
  };
}

type Perfil = {
  telefone?: string;
  email_contato?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  emergencia_nome?: string;
  emergencia_parentesco?: string;
  emergencia_telefone?: string;
};

/** O funcionário corrige os próprios dados de contato (LGPD art. 18, III). */
export const atualizarMeuPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: Perfil) => {
    const email = limpo(d?.email_contato, 255);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("E-mail inválido");
    const cep = limpo(d?.cep, 9);
    if (cep && !/^\d{5}-?\d{3}$/.test(cep)) throw new Error("CEP inválido");
    const uf = limpo(d?.uf, 2)?.toUpperCase() ?? null;
    if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error("UF inválida");
    return {
      telefone: limpo(d?.telefone, 20),
      email_contato: email,
      cep,
      logradouro: limpo(d?.logradouro, 150),
      numero: limpo(d?.numero, 20),
      complemento: limpo(d?.complemento, 80),
      bairro: limpo(d?.bairro, 80),
      cidade: limpo(d?.cidade, 80),
      uf,
      emergencia_nome: limpo(d?.emergencia_nome, 120),
      emergencia_parentesco: limpo(d?.emergencia_parentesco, 40),
      emergencia_telefone: limpo(d?.emergencia_telefone, 20),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await meuCadastro(context.userId);
    const { error } = await supabaseAdmin.from("funcionarios").update(data).eq("id", f.id);
    if (error) throw new Error("Não foi possível salvar seus dados");
    return { ok: true };
  });

/** Foto de perfil (não é a foto do reconhecimento facial). */
export const enviarFotoPerfil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { imagem: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await meuCadastro(context.userId);
    let path: string | null = null;
    if (data.imagem) {
      const arq = lerArquivo(data.imagem, 1_000_000, ["data:image/jpeg;base64,"]);
      path = `${f.empresa_id}/${f.id}/perfil-${Date.now()}.jpg`;
      const { error } = await supabaseAdmin.storage
        .from("perfil")
        .upload(path, arq.bytes, { contentType: "image/jpeg" });
      if (error) throw new Error("Não foi possível salvar a foto");
    }
    await supabaseAdmin.from("funcionarios").update({ foto_perfil_path: path }).eq("id", f.id);
    if (f.foto_perfil_path) await supabaseAdmin.storage.from("perfil").remove([f.foto_perfil_path]);
    return { ok: true };
  });

/** Funcionário envia o atestado pelo app; a empresa confere e aprova. */
export const enviarAtestado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { inicio: string; fim: string; observacao?: string; arquivo: string }) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(d?.inicio ?? "") || !re.test(d?.fim ?? ""))
      throw new Error("Informe as datas do atestado");
    if (d.fim < d.inicio) throw new Error("O término não pode ser antes do início");
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    if (d.inicio > hoje) throw new Error("O atestado não pode começar no futuro");
    return { ...d, observacao: limpo(d.observacao, 300) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await meuCadastro(context.userId);
    const s = await import("./seguranca.server");
    await s.exigirAbaixoDoLimite(
      supabaseAdmin,
      `atestado:${f.id}`,
      10,
      24 * 60,
      "Muitos envios hoje. Tente amanhã ou fale com o RH.",
    );
    const arq = lerArquivo(data.arquivo, 3_000_000);
    const path = `${f.empresa_id}/${f.id}/atestado-${Date.now()}.${arq.ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("atestados")
      .upload(path, arq.bytes, { contentType: arq.mime });
    if (upErr) throw new Error("Não foi possível enviar o arquivo");
    const { error } = await supabaseAdmin.from("atestados").insert({
      empresa_id: f.empresa_id,
      funcionario_id: f.id,
      inicio: data.inicio,
      fim: data.fim,
      observacao: data.observacao,
      arquivo_path: path,
    });
    if (error) {
      await supabaseAdmin.storage.from("atestados").remove([path]);
      throw new Error("Não foi possível registrar o atestado");
    }
    await s.registrarTentativa(supabaseAdmin, `atestado:${f.id}`);
    return { ok: true };
  });

export const analisarAtestado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; aprovar: boolean; resposta?: string }) => {
    if (!d?.aprovar && !limpo(d?.resposta, 300))
      throw new Error("Explique ao funcionário o motivo da recusa");
    return { ...d, resposta: limpo(d.resposta, 300) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!emp) throw new Error("Apenas a empresa pode analisar atestados");
    const { data: a } = await supabaseAdmin
      .from("atestados")
      .select("*")
      .eq("id", data.id)
      .eq("empresa_id", emp.id)
      .maybeSingle();
    if (!a) throw new Error("Atestado não encontrado");
    if (a.status !== "pendente") throw new Error("Este atestado já foi analisado");
    let afastamentoId: string | null = null;
    if (data.aprovar) {
      const { data: af, error } = await supabaseAdmin
        .from("afastamentos")
        .insert({
          empresa_id: emp.id,
          funcionario_id: a.funcionario_id,
          tipo: "atestado",
          inicio: a.inicio,
          fim: a.fim,
          observacao: "Atestado enviado pelo app",
        })
        .select("id")
        .single();
      if (error || !af) throw new Error("Não foi possível registrar o afastamento");
      afastamentoId = af.id;
    }
    const { data: atualizado } = await supabaseAdmin
      .from("atestados")
      .update({
        status: data.aprovar ? "aprovado" : "recusado",
        resposta: data.resposta,
        afastamento_id: afastamentoId,
        analisado_em: new Date().toISOString(),
      })
      .eq("id", a.id)
      .eq("status", "pendente")
      .select("id");
    if (!atualizado?.length) {
      if (afastamentoId) await supabaseAdmin.from("afastamentos").delete().eq("id", afastamentoId);
      throw new Error("Este atestado já foi analisado");
    }
    return { ok: true };
  });

/** Funcionário confirma que recebeu o aviso de férias (CLT art. 135). */
export const darCienciaFerias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await meuCadastro(context.userId);
    const { ipDaRequisicao } = await import("./requisicao.server");
    const { data: r } = await supabaseAdmin
      .from("ferias")
      .update({ ciente_em: new Date().toISOString(), ciente_ip: ipDaRequisicao() })
      .eq("id", data.id)
      .eq("funcionario_id", f.id)
      .is("ciente_em", null)
      .select("id");
    if (!r?.length) throw new Error("Aviso não encontrado ou já confirmado");
    return { ok: true };
  });
