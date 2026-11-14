// Somente servidor. Confere senha com um cliente descartável: chamar signInWithPassword
// no cliente administrativo (service role) guardaria a sessão do usuário nele e
// faria as próximas operações "de administrador" rodarem com as permissões desse usuário.
import { createClient } from "@supabase/supabase-js";

function clienteDescartavel() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key)
    throw new Error("SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY precisam estar configurados.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Retorna a sessão se a senha conferir, ou null. */
export async function entrarComSenha(email: string, senha: string) {
  if (!email || !senha) return null;
  const { data, error } = await clienteDescartavel().auth.signInWithPassword({
    email,
    password: senha,
  });
  if (error || !data.session) return null;
  return data.session;
}

export async function senhaConfere(email: string, senha: string): Promise<boolean> {
  return (await entrarComSenha(email, senha)) !== null;
}
