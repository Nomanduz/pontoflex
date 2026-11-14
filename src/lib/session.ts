import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "funcionario" | null;

export async function getPapel(): Promise<{ userId: string | null; papel: Papel }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { userId: null, papel: null };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const list = (roles ?? []).map((r) => r.role);
  return { userId: user.id, papel: list.includes("admin") ? "admin" : list.includes("funcionario") ? "funcionario" : null };
}
