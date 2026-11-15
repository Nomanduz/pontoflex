// Leitura dos movimentos do banco de horas pelo navegador (as permissões do banco limitam a
// empresa aos próprios funcionários e o funcionário a si mesmo).
import { supabase } from "@/integrations/supabase/client";
import { movimentosDasFolhas, type Movimento, type OrigemMov } from "./banco-horas";

export async function carregarMovimentos(
  funcionarioIds: string[],
): Promise<Map<string, (Movimento & { id?: string })[]>> {
  const out = new Map<string, (Movimento & { id?: string })[]>();
  if (!funcionarioIds.length) return out;
  const [{ data: folhas }, { data: lanc }] = await Promise.all([
    supabase
      .from("fechamentos")
      .select("funcionario_id, periodo_inicio, periodo_fim, resumo")
      .in("funcionario_id", funcionarioIds),
    supabase
      .from("banco_horas_lancamentos")
      .select("id, funcionario_id, data, minutos, tipo, descricao")
      .in("funcionario_id", funcionarioIds),
  ]);
  for (const id of funcionarioIds) out.set(id, []);
  for (const f of folhas ?? []) out.get(f.funcionario_id)?.push(...movimentosDasFolhas([f]));
  for (const l of lanc ?? [])
    out.get(l.funcionario_id)?.push({
      id: l.id,
      data: l.data,
      minutos: l.minutos,
      origem: l.tipo as OrigemMov,
      descricao: l.descricao,
    });
  return out;
}
