import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coordenadasValidas } from "./geo";

/** Define (ou remove) o local da empresa e o raio permitido para as marcações. */
export const configurarCerca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { latitude: number | null; longitude: number | null; raio_m: number | null }) => {
    if (d?.raio_m == null) return { latitude: null, longitude: null, raio_m: null };
    if (!coordenadasValidas(d.latitude, d.longitude)) throw new Error("Localização inválida");
    const raio = Math.round(Number(d.raio_m));
    if (!(raio >= 50 && raio <= 5000)) throw new Error("O raio deve ficar entre 50 e 5.000 metros");
    return { latitude: d.latitude, longitude: d.longitude, raio_m: raio };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, data: rows } = await supabaseAdmin
      .from("empresas")
      .update(data)
      .eq("user_id", context.userId)
      .select("id");
    if (error || !rows?.length) throw new Error("Não foi possível salvar o local da empresa");
    return { ok: true };
  });
