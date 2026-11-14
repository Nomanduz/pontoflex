import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** Cliente Supabase tipado com o esquema do PontoFlex. */
export type Banco = SupabaseClient<Database>;
export type Linha<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
