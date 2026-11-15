import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Lista os comunicados e quais o funcionário já leu. */
export function useComunicados() {
  return useQuery({
    queryKey: ["comunicados-func"],
    queryFn: async () => {
      const [{ data: com }, { data: lidos }] = await Promise.all([
        supabase
          .from("comunicados")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("comunicados_leitura").select("comunicado_id, lido_em"),
      ]);
      const mapa = new Map((lidos ?? []).map((l) => [l.comunicado_id, l.lido_em]));
      return (com ?? []).map((c) => ({ ...c, lido_em: mapa.get(c.id) ?? null }));
    },
  });
}
