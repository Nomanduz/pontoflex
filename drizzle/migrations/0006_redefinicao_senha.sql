-- Recuperação de senha da empresa ("Esqueci minha senha" e link gerado pela equipe Nomanduz).
-- Só o servidor (service_role) acessa: o navegador nunca lê nem grava esta tabela.
create table public.redefinicoes_senha (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo_hash text not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  origem text not null check (origem in ('email', 'nomanduz')),
  created_at timestamptz not null default now()
);
create index redefinicoes_senha_empresa_idx on public.redefinicoes_senha (empresa_id, created_at);
revoke all on public.redefinicoes_senha from anon, authenticated;
grant all on public.redefinicoes_senha to service_role;
alter table public.redefinicoes_senha enable row level security;
