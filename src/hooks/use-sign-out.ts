import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { marcasSessao } from "@/lib/sessao-politica";

export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    marcasSessao.limpar();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }, [queryClient, navigate]);
}
