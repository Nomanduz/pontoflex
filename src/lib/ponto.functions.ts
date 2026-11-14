import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TIPOS, type Tipo } from "./ponto";

const MIN_CONFIANCA = 0.7;

function validarImagem(img: unknown): string {
  if (typeof img !== "string" || !img.startsWith("data:image/jpeg;base64,")) throw new Error("Foto inválida");
  if (img.length > 3_000_000) throw new Error("Foto muito grande");
  return img;
}

async function meuFuncionario(supabase: any, userId: string) {
  const { data } = await supabase
    .from("funcionarios")
    .select("id, empresa_id, ativo, foto_path")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || !data.ativo) throw new Error("Acesso de funcionário não encontrado ou desativado");
  return data as { id: string; empresa_id: string; ativo: boolean; foto_path: string | null };
}

export const cadastrarRosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { imagem: string }) => ({ imagem: validarImagem(d?.imagem) }))
  .handler(async ({ data, context }) => {
    const f = await meuFuncionario(context.supabase, context.userId);
    if (f.foto_path) throw new Error("Seu rosto já está cadastrado. Peça ao administrador para redefinir.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dataUrlToBytes } = await import("./face.server");
    const path = `${f.empresa_id}/${f.id}/referencia-${Date.now()}.jpg`;
    const { error } = await supabaseAdmin.storage.from("faces").upload(path, dataUrlToBytes(data.imagem), { contentType: "image/jpeg" });
    if (error) throw new Error("Não foi possível salvar a foto");
    await supabaseAdmin.from("funcionarios").update({ foto_path: path }).eq("id", f.id);
    return { ok: true };
  });

export const registrarPonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { imagem: string; latitude: number; longitude: number; tipo: Tipo }) => {
    if (!Number.isFinite(d?.latitude) || !Number.isFinite(d?.longitude)) throw new Error("Localização obrigatória");
    if (!TIPOS.includes(d.tipo)) throw new Error("Tipo inválido");
    return { ...d, imagem: validarImagem(d.imagem) };
  })
  .handler(async ({ data, context }) => {
    const f = await meuFuncionario(context.supabase, context.userId);
    if (!f.foto_path) throw new Error("Cadastre seu rosto antes de registrar o ponto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { compararRostos, bytesToDataUrl, dataUrlToBytes } = await import("./face.server");

    const { data: ref, error: refErr } = await supabaseAdmin.storage.from("faces").download(f.foto_path);
    if (refErr || !ref) throw new Error("Foto de referência não encontrada. Peça ao administrador para redefinir.");
    const refUrl = bytesToDataUrl(new Uint8Array(await ref.arrayBuffer()));

    const r = await compararRostos(refUrl, data.imagem);
    if (!r.rosto_real) throw new Error("Não detectamos seu rosto com clareza. Tente novamente com boa iluminação.");
    if (!r.mesma_pessoa || r.confianca < MIN_CONFIANCA) throw new Error("Rosto não reconhecido. O ponto não foi registrado.");

    const path = `${f.empresa_id}/${f.id}/${Date.now()}.jpg`;
    await supabaseAdmin.storage.from("faces").upload(path, dataUrlToBytes(data.imagem), { contentType: "image/jpeg" });

    const { data: ins, error } = await supabaseAdmin
      .from("pontos")
      .insert({
        funcionario_id: f.id,
        empresa_id: f.empresa_id,
        tipo: data.tipo,
        latitude: data.latitude,
        longitude: data.longitude,
        selfie_path: path,
        face_status: "aprovado",
        face_confianca: r.confianca,
      })
      .select("tipo, data_hora")
      .single();
    if (error) throw new Error(error.message.includes("esperada") || error.message.includes("encerrada") ? error.message : "Não foi possível registrar o ponto");
    return { ...ins, confianca: r.confianca };
  });

export const redefinirRosto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    // RLS update policy only matches funcionários of the caller's empresa
    const { data: rows, error } = await context.supabase.from("funcionarios").update({ foto_path: null }).eq("id", data.id).select("id");
    if (error || !rows?.length) throw new Error("Funcionário não encontrado");
    return { ok: true };
  });
