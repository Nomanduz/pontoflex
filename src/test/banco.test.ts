// @vitest-environment node
/**
 * Aplica todas as migrações num Postgres real (PGlite) com o ambiente do Supabase simulado
 * (papéis, auth.uid(), storage e privilégios padrão) e verifica as regras de segurança.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, describe, expect, it } from "vitest";

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema extensions;
create schema storage;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  _parts := string_to_array(name, '/');
  return _parts[1:array_length(_parts, 1) - 1];
end $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Igual ao Supabase: tudo novo no schema public nasce com privilégio total para estes papéis.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const U = {
  empA: "00000000-0000-0000-0000-00000000000a",
  empB: "00000000-0000-0000-0000-00000000000b",
  funcA1: "00000000-0000-0000-0000-0000000000a1",
  funcB1: "00000000-0000-0000-0000-0000000000b1",
  nomanduz: "00000000-0000-0000-0000-0000000000ff",
};

let db: PGlite;

async function comoServico() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}
async function como(uid: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`,
  );
}
async function falha(sqlText: string, params: unknown[] = []) {
  try {
    await db.query(sqlText, params);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`Esperava falha, mas executou: ${sqlText}`);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  const pasta = join(process.cwd(), "drizzle", "migrations");
  for (const f of readdirSync(pasta)
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(join(pasta, f), "utf8"));
  }
  // Dados de teste
  await db.exec(`
    insert into auth.users (id) values ('${U.empA}'), ('${U.empB}'), ('${U.funcA1}'), ('${U.funcB1}'), ('${U.nomanduz}');
    insert into public.user_roles (user_id, role) values ('${U.empA}', 'admin'), ('${U.empB}', 'admin'),
      ('${U.funcA1}', 'funcionario'), ('${U.funcB1}', 'funcionario'), ('${U.nomanduz}', 'superadmin');
    insert into public.empresas (id, documento, tipo_documento, razao_social, user_id) values
      ('10000000-0000-0000-0000-00000000000a', '11.222.333/0001-81', 'CNPJ', 'Empresa A', '${U.empA}'),
      ('10000000-0000-0000-0000-00000000000b', '529.982.247-25', 'CPF', 'Empresa B (CPF)', '${U.empB}');
    insert into public.funcionarios (id, empresa_id, user_id, nome, cpf, matricula) values
      ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '${U.funcA1}', 'Ana', '111.444.777-35', 'A01'),
      ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', '${U.funcB1}', 'Bruno', '111.444.777-35', 'A01');
    insert into public.solicitacoes_cadastro (tipo_documento, documento, razao_social, responsavel, email)
      values ('CNPJ', '11.444.777/0001-61', 'Nova Ltda', 'Carla', 'carla@exemplo.com');
  `);
});

describe("migrações", () => {
  it("aplicam do zero e criam o bucket privado de fotos", async () => {
    const { rows } = await db.query<{ public: boolean }>(
      `select public from storage.buckets where id = 'faces'`,
    );
    expect(rows).toEqual([{ public: false }]);
  });

  it("mesmo CPF e mesma matrícula podem existir em empresas diferentes", async () => {
    await comoServico();
    const { rows } = await db.query(
      `select id from public.funcionarios where cpf = '111.444.777-35'`,
    );
    expect(rows).toHaveLength(2);
  });

  it("CPF e matrícula (sem diferenciar maiúsculas) são únicos dentro da empresa", async () => {
    await comoServico();
    expect(
      await falha(
        `insert into public.funcionarios (empresa_id, nome, cpf, matricula) values ('10000000-0000-0000-0000-00000000000a', 'X', '111.444.777-35', 'Z9')`,
      ),
    ).toMatch(/unique|duplicate/i);
    expect(
      await falha(
        `insert into public.funcionarios (empresa_id, nome, cpf, matricula) values ('10000000-0000-0000-0000-00000000000a', 'X', '935.411.347-80', 'a01')`,
      ),
    ).toMatch(/unique|duplicate/i);
  });

  it("matrícula é obrigatória", async () => {
    await comoServico();
    expect(
      await falha(
        `insert into public.funcionarios (empresa_id, nome, cpf) values ('10000000-0000-0000-0000-00000000000a', 'X', '935.411.347-80')`,
      ),
    ).toMatch(/null/i);
  });
});

describe("isolamento entre empresas (RLS)", () => {
  it("o administrador só vê os funcionários da própria empresa", async () => {
    await como(U.empA);
    const { rows } = await db.query<{ nome: string }>(`select nome from public.funcionarios`);
    expect(rows.map((r) => r.nome)).toEqual(["Ana"]);
  });

  it("o funcionário só vê a si mesmo e a própria empresa", async () => {
    await como(U.funcB1);
    expect((await db.query(`select nome from public.funcionarios`)).rows).toEqual([
      { nome: "Bruno" },
    ]);
    expect((await db.query(`select razao_social from public.empresas`)).rows).toEqual([
      { razao_social: "Empresa B (CPF)" },
    ]);
  });

  it("funcionário desativado deixa de ler os dados da empresa", async () => {
    await comoServico();
    await db.exec(
      `update public.funcionarios set ativo = false where id = '20000000-0000-0000-0000-0000000000b1'`,
    );
    await como(U.funcB1);
    expect((await db.query(`select id from public.empresas`)).rows).toHaveLength(0);
    await comoServico();
    await db.exec(
      `update public.funcionarios set ativo = true where id = '20000000-0000-0000-0000-0000000000b1'`,
    );
  });

  it("tabelas internas ficam invisíveis para usuários comuns", async () => {
    await como(U.empA);
    expect((await db.query(`select * from public.solicitacoes_cadastro`)).rows).toHaveLength(0);
    expect((await db.query(`select * from public.tentativas`)).rows).toHaveLength(0);
    expect((await db.query(`select * from public.codigos_senha_empresa`)).rows).toHaveLength(0);
    // links de redefinição de senha: nem leitura nem gravação pelo navegador
    await expect(db.query(`select * from public.redefinicoes_senha`)).rejects.toThrow();
    await expect(
      db.query(
        `insert into public.redefinicoes_senha (empresa_id, codigo_hash, expira_em, origem)
         select id, 'x', now() + interval '1 day', 'email' from public.empresas limit 1`,
      ),
    ).rejects.toThrow();
  });

  it("a equipe Nomanduz (superadmin) vê solicitações e todas as empresas", async () => {
    await como(U.nomanduz);
    expect((await db.query(`select * from public.solicitacoes_cadastro`)).rows).toHaveLength(1);
    expect((await db.query(`select * from public.empresas`)).rows).toHaveLength(2);
  });
});

describe("o navegador não altera campos sensíveis", () => {
  it("empresa: pode mudar o nome, mas não o documento nem as senhas mestras", async () => {
    await como(U.empA);
    await db.query(`update public.empresas set razao_social = 'Empresa A Ltda'`);
    expect(await falha(`update public.empresas set documento = '00.000.000/0000-00'`)).toMatch(
      /permission denied/i,
    );
    expect(await falha(`update public.empresas set senha_mestra_leitura = 'x'`)).toMatch(
      /permission denied/i,
    );
    expect(await falha(`update public.empresas set raio_m = 5000`)).toMatch(/permission denied/i);
  });

  it("funcionário: admin edita dados cadastrais, mas não rosto, status nem exclui", async () => {
    await como(U.empA);
    await db.query(`update public.funcionarios set cargo = 'Caixa' where nome = 'Ana'`);
    expect(await falha(`update public.funcionarios set foto_status = 'aprovada'`)).toMatch(
      /permission denied/i,
    );
    expect(await falha(`update public.funcionarios set face_id = 'x'`)).toMatch(
      /permission denied/i,
    );
    expect(await falha(`update public.funcionarios set ativo = false`)).toMatch(
      /permission denied/i,
    );
    expect(await falha(`delete from public.funcionarios`)).toMatch(/permission denied/i);
  });

  it("ninguém insere marcação de ponto direto pelo navegador", async () => {
    await como(U.funcA1);
    expect(
      await falha(
        `insert into public.pontos (funcionario_id, empresa_id, tipo, latitude, longitude) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'ENTRADA', -19.9, -43.9)`,
      ),
    ).toMatch(/permission denied/i);
  });

  it("superadmin também não altera empresas pelo navegador (só pelo servidor)", async () => {
    await como(U.nomanduz);
    const r = await db.query(`update public.empresas set razao_social = 'hack' returning id`);
    expect(r.rows).toHaveLength(0);
  });
});

describe("marcações e guarda do histórico", () => {
  it("o banco impõe a sequência ENTRADA → SAÍDA ALMOÇO", async () => {
    await comoServico();
    await db.query(
      `insert into public.pontos (funcionario_id, empresa_id, tipo, latitude, longitude) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'ENTRADA', -19.9, -43.9)`,
    );
    expect(
      await falha(
        `insert into public.pontos (funcionario_id, empresa_id, tipo, latitude, longitude) values ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'SAIDA', -19.9, -43.9)`,
      ),
    ).toMatch(/SAIDA_ALMOCO/);
  });

  it("funcionário com marcações não pode ser apagado (lei exige guardar o histórico)", async () => {
    await comoServico();
    expect(
      await falha(
        `delete from public.funcionarios where id = '20000000-0000-0000-0000-0000000000a1'`,
      ),
    ).toMatch(/foreign key|violates/i);
  });

  it("log do terminal não impede excluir um funcionário sem marcações", async () => {
    await comoServico();
    await db.exec(`
      insert into public.funcionarios (id, empresa_id, nome, cpf, matricula) values ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'Errado', '935.411.347-80', 'A02');
      insert into public.terminal_logs (empresa_id, funcionario_id, acao) values ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-0000000000a2', 'cadastro_rosto');
      delete from public.funcionarios where id = '20000000-0000-0000-0000-0000000000a2';
    `);
    const { rows } = await db.query<{ funcionario_id: string | null }>(
      `select funcionario_id from public.terminal_logs where acao = 'cadastro_rosto'`,
    );
    expect(rows).toEqual([{ funcionario_id: null }]);
  });

  it("excluir a empresa inteira (empresa de teste) remove tudo de uma vez", async () => {
    await comoServico();
    await db.exec(`delete from public.empresas where id = '10000000-0000-0000-0000-00000000000a'`);
    for (const t of ["funcionarios", "pontos", "terminal_logs"]) {
      const { rows } = await db.query(
        `select 1 from public.${t} where empresa_id = '10000000-0000-0000-0000-00000000000a'`,
      );
      expect(rows, t).toHaveLength(0);
    }
    expect((await db.query(`select 1 from public.empresas`)).rows).toHaveLength(1);
  });
});
