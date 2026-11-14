import { supabase } from "@/integrations/supabase/client";

export type Papel = "superadmin" | "admin" | "funcionario" | null;

export async function getPapel(): Promise<{ userId: string | null; papel: Papel }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { userId: null, papel: null };
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const list = (roles ?? []).map((r) => r.role as string);
  const papel: Papel = list.includes("superadmin")
    ? "superadmin"
    : list.includes("admin")
      ? "admin"
      : list.includes("funcionario")
        ? "funcionario"
        : null;
  return { userId: user.id, papel };
}
