// Aplica as migrações SQL (drizzle/migrations/*.sql) em ordem, uma única vez cada.
// Uso: bun run db:migrate   (lê DATABASE_URL do .env — a "Connection string" do Supabase)
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error(
    "Defina DATABASE_URL no .env (Supabase → Project Settings → Database → Connection string).",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const pasta = join("drizzle", "migrations");

try {
  await sql`create table if not exists public._migracoes (nome text primary key, aplicada_em timestamptz not null default now())`;
  const feitas = new Set(
    (await sql<{ nome: string }[]>`select nome from public._migracoes`).map((r) => r.nome),
  );
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith(".sql")).sort();
  let novas = 0;
  for (const nome of arquivos) {
    if (feitas.has(nome)) continue;
    const conteudo = await readFile(join(pasta, nome), "utf8");
    process.stdout.write(`→ ${nome} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(conteudo);
      await tx`insert into public._migracoes (nome) values (${nome})`;
    });
    console.log("ok");
    novas++;
  }
  console.log(novas ? `${novas} migração(ões) aplicada(s).` : "Banco já está atualizado.");
} catch (e) {
  console.error("\nFalha na migração:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
