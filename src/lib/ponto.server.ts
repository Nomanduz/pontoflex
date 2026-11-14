// Somente servidor: regras compartilhadas entre o terminal e o app do funcionário.
import { avaliarCerca, type Cerca } from "./geo";
import { nextTipo, type Tipo } from "./ponto";
import { dataUrlToBytes } from "./face.server";
import type { Banco } from "@/integrations/supabase/banco";

type Admin = Banco;

export async function proximaMarcacao(admin: Admin, funcionarioId: string): Promise<Tipo | null> {
  const since = new Date(Date.now() - 30 * 3600_000).toISOString();
  const { data: pts } = await admin
    .from("pontos")
    .select("tipo, data_hora")
    .eq("funcionario_id", funcionarioId)
    .gte("data_hora", since)
    .order("data_hora");
  return nextTipo(pts ?? []);
}

export async function registrarMarcacao(
  admin: Admin,
  p: {
    empresa: Cerca & { id: string };
    funcionarioId: string;
    selfiePath: string;
    similaridade: number;
    latitude: number;
    longitude: number;
  },
): Promise<{ tipo: Tipo; data_hora: string; nome: string; distancia_m: number | null }> {
  const { data: f } = await admin
    .from("funcionarios")
    .select("id, nome, ativo, foto_status")
    .eq("id", p.funcionarioId)
    .eq("empresa_id", p.empresa.id)
    .maybeSingle();
  if (!f || !f.ativo || f.foto_status !== "aprovada")
    throw new Error("Funcionário não encontrado ou desativado");

  const cerca = avaliarCerca(p.empresa, p.latitude, p.longitude);
  if (cerca.fora) {
    throw new Error(
      `Marcação fora do local permitido: você está a ${cerca.distancia_m} m da empresa (limite ${p.empresa.raio_m} m).`,
    );
  }
  const tipo = await proximaMarcacao(admin, f.id);
  if (!tipo)
    throw new Error(
      "Jornada encerrada há menos de 1 hora. Aguarde para registrar a próxima entrada.",
    );

  const { data: ins, error } = await admin
    .from("pontos")
    .insert({
      funcionario_id: f.id,
      empresa_id: p.empresa.id,
      tipo,
      latitude: p.latitude,
      longitude: p.longitude,
      selfie_path: p.selfiePath,
      face_status: "aprovado",
      face_confianca: Math.round(p.similaridade * 10) / 1000,
      distancia_m: cerca.distancia_m,
      fora_do_raio: false,
    })
    .select("tipo, data_hora")
    .single();
  if (error) {
    const m = String(error.message ?? "");
    throw new Error(
      m.includes("esperada") || m.includes("encerrada") || m.includes("inativo")
        ? m
        : "Não foi possível registrar o ponto",
    );
  }
  return {
    tipo: ins.tipo as Tipo,
    data_hora: ins.data_hora as string,
    nome: f.nome as string,
    distancia_m: cerca.distancia_m,
  };
}

/** Guarda a foto de referência e deixa aguardando a aprovação do administrador. */
export async function salvarReferencia(
  admin: Admin,
  p: { empresaId: string; funcionario: { id: string; foto_path: string | null }; imagem: string },
) {
  const path = `${p.empresaId}/${p.funcionario.id}/referencia-${Date.now()}.jpg`;
  const { error } = await admin.storage
    .from("faces")
    .upload(path, dataUrlToBytes(p.imagem), { contentType: "image/jpeg" });
  if (error) throw new Error("Não foi possível salvar a foto");
  const agora = new Date().toISOString();
  const { error: upErr } = await admin
    .from("funcionarios")
    .update({
      foto_path: path,
      foto_status: "pendente",
      foto_enviada_em: agora,
      consentimento_biometria_em: agora,
      face_id: null,
    })
    .eq("id", p.funcionario.id);
  if (upErr) {
    await admin.storage.from("faces").remove([path]);
    throw new Error("Não foi possível salvar a foto");
  }
  if (p.funcionario.foto_path && p.funcionario.foto_path !== path)
    await admin.storage.from("faces").remove([p.funcionario.foto_path]);
}
