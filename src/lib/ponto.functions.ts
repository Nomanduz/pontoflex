import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coordenadasValidas } from "./geo";
import type { Banco } from "@/integrations/supabase/banco";

async function meuFuncionario(supabase: Banco, userId: string) {
  const { data } = await supabase
    .from("funcionarios")
    .select("id, empresa_id, ativo, foto_path, foto_status, face_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.ativo) throw new Error("Acesso de funcionário não encontrado ou desativado");
  return data as {
    id: string;
    empresa_id: string;
    ativo: boolean;
    foto_path: string | null;
    foto_status: string;
    face_id: string | null;
  };
}

/** O funcionário envia o próprio rosto de referência; o administrador aprova antes de valer. */
export const cadastrarRosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { imagem: string; consentimento: boolean }) => {
    if (d?.consentimento !== true) throw new Error("É preciso aceitar o termo de uso da biometria");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { validarImagem } = await import("./face.server");
    const imagem = validarImagem(data.imagem);
    const f = await meuFuncionario(context.supabase, context.userId);
    if (!["sem_foto", "recusada"].includes(f.foto_status)) {
      throw new Error(
        f.foto_status === "pendente"
          ? "Seu rosto já foi enviado e aguarda aprovação."
          : "Seu rosto já está cadastrado. Peça ao administrador para redefinir.",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { salvarReferencia } = await import("./ponto.server");
    await salvarReferencia(supabaseAdmin, { empresaId: f.empresa_id, funcionario: f, imagem });
    return { ok: true };
  });

export const registrarPonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { imagem: string; latitude: number; longitude: number; precisao?: number }) => {
    if (!coordenadasValidas(d?.latitude, d?.longitude))
      throw new Error("Localização obrigatória. Permita o acesso à localização.");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { validarImagem, buscarRosto, dataUrlToBytes } = await import("./face.server");
    const imagem = validarImagem(data.imagem);
    const f = await meuFuncionario(context.supabase, context.userId);
    if (f.foto_status === "pendente")
      throw new Error("Seu rosto aguarda aprovação do administrador.");
    if (f.foto_status !== "aprovada" || !f.face_id)
      throw new Error("Cadastre seu rosto antes de registrar o ponto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { exigirAbaixoDoLimite, registrarTentativa } = await import("./seguranca.server");
    await exigirAbaixoDoLimite(
      supabaseAdmin,
      `ponto-falha:${f.id}`,
      10,
      10,
      "Muitas tentativas sem reconhecimento. Aguarde 10 minutos ou use o terminal da empresa.",
    );

    const bytes = dataUrlToBytes(imagem);
    const achado = await buscarRosto(f.empresa_id, bytes);
    if (!achado || achado.funcionarioId !== f.id) {
      await registrarTentativa(supabaseAdmin, `ponto-falha:${f.id}`);
      throw new Error("Rosto não reconhecido. O ponto não foi registrado.");
    }
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, latitude, longitude, raio_m")
      .eq("id", f.empresa_id)
      .single();
    if (!emp) throw new Error("Empresa não encontrada");
    const path = `${f.empresa_id}/${f.id}/${Date.now()}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("faces")
      .upload(path, bytes, { contentType: "image/jpeg" });
    if (upErr) throw new Error("Não foi possível salvar a foto da marcação. Tente novamente.");
    const { registrarMarcacao } = await import("./ponto.server");
    try {
      const r = await registrarMarcacao(supabaseAdmin, {
        empresa: emp,
        funcionarioId: f.id,
        selfiePath: path,
        similaridade: achado.similaridade,
        latitude: data.latitude,
        longitude: data.longitude,
        precisao: data.precisao,
      });
      return { tipo: r.tipo, data_hora: r.data_hora, confianca: achado.similaridade / 100 };
    } catch (e) {
      await supabaseAdmin.storage.from("faces").remove([path]);
      throw e;
    }
  });

async function funcionarioDaMinhaEmpresa(context: { supabase: Banco; userId: string }, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: emp } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!emp) throw new Error("Apenas o administrador da empresa pode fazer isso");
  const { data: f } = await supabaseAdmin
    .from("funcionarios")
    .select("id, nome, foto_path, foto_status, face_id, empresa_id")
    .eq("id", id)
    .eq("empresa_id", emp.id)
    .maybeSingle();
  if (!f) throw new Error("Funcionário não encontrado");
  return { supabaseAdmin, f };
}

/** Administrador aprova (indexa no Rekognition) ou recusa a foto de referência enviada. */
export const analisarRosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string; aprovar: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await funcionarioDaMinhaEmpresa(context, data.id);
    if (f.foto_status !== "pendente" || !f.foto_path)
      throw new Error("Não há foto aguardando aprovação");
    if (!data.aprovar) {
      await supabaseAdmin.from("funcionarios").update({ foto_status: "recusada" }).eq("id", f.id);
      return { ok: true, status: "recusada" };
    }
    const { data: ref, error } = await supabaseAdmin.storage.from("faces").download(f.foto_path);
    if (error || !ref) throw new Error("Foto de referência não encontrada");
    const { indexarRosto, removerRosto, FaceErro } = await import("./face.server");
    let faceId: string;
    try {
      faceId = await indexarRosto(f.empresa_id, f.id, new Uint8Array(await ref.arrayBuffer()));
    } catch (e) {
      if (e instanceof FaceErro && e.codigo !== "indisponivel") {
        await supabaseAdmin.from("funcionarios").update({ foto_status: "recusada" }).eq("id", f.id);
        throw new Error(
          `Foto recusada automaticamente: ${e.message} Peça ao funcionário para enviar outra.`,
        );
      }
      throw e;
    }
    if (f.face_id) await removerRosto(f.empresa_id, [f.face_id]);
    await supabaseAdmin
      .from("funcionarios")
      .update({ foto_status: "aprovada", face_id: faceId })
      .eq("id", f.id);
    return { ok: true, status: "aprovada" };
  });

export const redefinirRosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, f } = await funcionarioDaMinhaEmpresa(context, data.id);
    if (f.face_id) {
      const { removerRosto } = await import("./face.server");
      await removerRosto(f.empresa_id, [f.face_id]);
    }
    if (f.foto_path) await supabaseAdmin.storage.from("faces").remove([f.foto_path]);
    await supabaseAdmin
      .from("funcionarios")
      .update({ foto_path: null, face_id: null, foto_status: "sem_foto" })
      .eq("id", f.id);
    return { ok: true };
  });
