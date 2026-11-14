create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'funcionario');
create type public.ponto_tipo as enum ('ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  cnpj varchar(18) unique not null,
  razao_social varchar(255) not null,
  email varchar(255),
  user_id uuid unique not null,
  created_at timestamptz not null default now()
);
grant select, update on public.empresas to authenticated;
grant all on public.empresas to service_role;
alter table public.empresas enable row level security;

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  user_id uuid unique,
  nome varchar(255) not null,
  cpf varchar(14) unique not null,
  telefone varchar(20),
  cargo varchar(120),
  matricula varchar(50),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.funcionarios to authenticated;
grant all on public.funcionarios to service_role;
alter table public.funcionarios enable row level security;

create table public.pontos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo public.ponto_tipo not null,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  data_hora timestamptz not null default now()
);
create index pontos_func_data_idx on public.pontos (funcionario_id, data_hora);
create index pontos_emp_data_idx on public.pontos (empresa_id, data_hora);
grant select, insert on public.pontos to authenticated;
grant all on public.pontos to service_role;
alter table public.pontos enable row level security;

create or replace function public.my_empresa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.empresas where user_id = auth.uid()
$$;
create or replace function public.my_funcionario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.funcionarios where user_id = auth.uid() and ativo
$$;
create or replace function public.my_funcionario_empresa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from public.funcionarios where user_id = auth.uid()
$$;

create policy "Empresa readable by owner or staff" on public.empresas for select to authenticated
  using (user_id = auth.uid() or id = public.my_funcionario_empresa_id());
create policy "Empresa updatable by owner" on public.empresas for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Funcionarios readable by admin or self" on public.funcionarios for select to authenticated
  using (empresa_id = public.my_empresa_id() or user_id = auth.uid());
create policy "Funcionarios updatable by admin" on public.funcionarios for update to authenticated
  using (empresa_id = public.my_empresa_id()) with check (empresa_id = public.my_empresa_id());
create policy "Funcionarios deletable by admin" on public.funcionarios for delete to authenticated
  using (empresa_id = public.my_empresa_id());

create policy "Pontos readable by admin or self" on public.pontos for select to authenticated
  using (empresa_id = public.my_empresa_id() or funcionario_id = public.my_funcionario_id());
create policy "Pontos insertable by self" on public.pontos for insert to authenticated
  with check (funcionario_id = public.my_funcionario_id());

-- Prevent CPF/empresa changes through admin edits
create or replace function public.funcionarios_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    new.empresa_id := old.empresa_id;
    new.user_id := old.user_id;
    new.cpf := old.cpf;
  end if;
  return new;
end $$;
create trigger funcionarios_guard before update on public.funcionarios
  for each row execute function public.funcionarios_guard();

-- Enforce server time, empresa and daily sequence on punches
create or replace function public.pontos_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_last public.ponto_tipo;
  v_expected public.ponto_tipo;
  v_day_start timestamptz;
  v_ativo boolean;
begin
  select empresa_id, ativo into new.empresa_id, v_ativo from public.funcionarios where id = new.funcionario_id;
  if v_ativo is not true then raise exception 'Funcionário inativo'; end if;
  new.data_hora := now();
  v_day_start := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  select tipo into v_last from public.pontos
    where funcionario_id = new.funcionario_id and data_hora >= v_day_start
    order by data_hora desc limit 1;
  v_expected := case v_last
    when 'ENTRADA' then 'SAIDA_ALMOCO'
    when 'SAIDA_ALMOCO' then 'RETORNO_ALMOCO'
    when 'RETORNO_ALMOCO' then 'SAIDA'
    when 'SAIDA' then null
    else 'ENTRADA' end;
  if v_expected is null then raise exception 'Jornada de hoje já foi encerrada'; end if;
  if new.tipo <> v_expected then raise exception 'Próxima marcação esperada: %', v_expected; end if;
  return new;
end $$;

-- Export: obsolete demo accounts and credentials intentionally omitted.

create trigger pontos_validate before insert on public.pontos
  for each row execute function public.pontos_validate();