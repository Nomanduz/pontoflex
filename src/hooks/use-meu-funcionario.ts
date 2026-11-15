import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Cadastro completo do funcionário logado e a empresa dele. */
export function useMeuFuncionario() {
  return useQuery({
    queryKey: ["meu-cadastro"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: f }, { data: emp }] = await Promise.all([
        supabase.from("funcionarios").select("*").eq("user_id", u.user!.id).maybeSingle(),
        supabase
          .from("empresas")
          .select("id, razao_social, documento, tipo_documento, banco_horas_meses")
          .maybeSingle(),
      ]);
      return { f, emp };
    },
  });
}
