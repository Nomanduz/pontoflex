// Cria (ou promove) o acesso da equipe Nomanduz ao painel /nomanduz.
// Uso: bun run criar-superadmin [email]
// A senha vem de SUPERADMIN_SENHA no .env; sem ela, uma senha forte é gerada e exibida uma vez.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !chave) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.");
  process.exit(1);
}
const email = (process.argv[2] ?? process.env["NOMANDUZ_ADMIN_EMAIL"] ?? "").trim().toLowerCase();
if (!email.includes("@")) {
  console.error(
    "Informe o e-mail: bun run criar-superadmin seu@email.com (ou NOMANDUZ_ADMIN_EMAIL no .env).",
  );
  process.exit(1);
}

const admin = createClient(url, chave, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const senhaGerada = !process.env["SUPERADMIN_SENHA"];
const senha = process.env["SUPERADMIN_SENHA"] ?? `${randomBytes(12).toString("base64url")}#A1`;

let userId: string | undefined;
const { data: criado, error } = await admin.auth.admin.createUser({
  email,
  password: senha,
  email_confirm: true,
});
if (criado?.user) {
  userId = criado.user.id;
  console.log(`Usuário criado: ${email}`);
} else {
  // Já existe: localiza e promove (a senha não é alterada).
  for (let page = 1; !userId && page < 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!data.users.length) break;
  }
  if (!userId) {
    console.error("Não foi possível criar nem encontrar o usuário:", error?.message);
    process.exit(1);
  }
  console.log(`Usuário já existia: ${email} (senha mantida)`);
}

const { error: roleErr } = await admin
  .from("user_roles")
  .upsert({ user_id: userId, role: "superadmin" }, { onConflict: "user_id,role" });
if (roleErr) {
  console.error("Falha ao conceder o papel superadmin:", roleErr.message);
  process.exit(1);
}
console.log('Papel superadmin concedido. Entre em /login → "Acesso equipe Nomanduz".');
if (criado?.user && senhaGerada)
  console.log(`Senha gerada (anote, não será exibida de novo): ${senha}`);
