-- Perfil do funcionário, departamento, banco de horas, atestados, ciência de férias e Comunica RH.
-- LGPD: endereço e contato de emergência servem à execução do contrato e à proteção da vida
-- (art. 7º, V e VII); atestados são dados de saúde tratados para obrigação legal (art. 11, II, a).

-- ===== Perfil e departamento =====
alter table public.funcionarios
  add column departamento varchar(80),
  add column email_contato varchar(255),
  add column cep varchar(9),
  add column logradouro varchar(150),
  add column numero varchar(20),
  add column complemento varchar(80),
  add column bairro varchar(80),
  add column cidade varchar(80),
  add column uf char(2),
  add column emergencia_nome varchar(120),
  add column emergencia_parentesco varchar(40),
  add column emergencia_telefone varchar(20),
  add column foto_perfil_path text;
-- O administrador também pode corrigir esses dados; o funcionário edita os próprios pelo servidor.
grant update (departamento, email_contato, cep, logradouro, numero, complemento, bairro, cidade, uf,
  emergencia_nome, emergencia_parentesco, emergencia_telefone) on public.funcionarios to authenticated;

create or replace function public.my_funcionario_departamento()
returns text language sql stable security definer set search_path = public as $$
  select departamento from public.funcionarios where user_id = auth.uid() and ativo
$$;

-- ===== Banco de horas =====
-- Prazo para compensar: 6 meses (acordo individual, CLT art. 59 §5º) ou 12 (acordo coletivo).
alter table public.empresas
  add column banco_horas_meses smallint not null default 6 check (banco_horas_meses in (0, 6, 12));
grant update (banco_horas_meses) on public.empresas to authenticated;

create table public.banco_horas_lancamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id),
  data date not null,
  minutos int not null check (minutos <> 0 and minutos between -14400 and 14400),
  tipo text not null check (tipo in ('folga', 'pagamento', 'ajuste')),
  descricao varchar(200) not null,
  created_at timestamptz not null default now()
);
create index banco_horas_func_idx on public.banco_horas_lancamentos (funcionario_id, data);
grant select, insert, delete on public.banco_horas_lancamentos to authenticated;
grant all on public.banco_horas_lancamentos to service_role;
alter table public.banco_horas_lancamentos enable row level security;
create policy "Banco de horas gerido pela empresa" on public.banco_horas_lancamentos for all
  to authenticated using (empresa_id = public.my_empresa_id())
  with check (empresa_id = public.my_empresa_id());
create policy "Banco de horas visivel ao proprio funcionario" on public.banco_horas_lancamentos
  for select to authenticated using (funcionario_id = public.my_funcionario_id());
create trigger banco_horas_mesma_empresa before insert or update on public.banco_horas_lancamentos
  for each row execute function public.vinculo_mesma_empresa();

-- ===== Ciência do aviso de férias (CLT art. 135) =====
alter table public.ferias add column ciente_em timestamptz, add column ciente_ip text;

-- ===== Atestados enviados pelo funcionário =====
create table public.atestados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id),
  inicio date not null,
  fim date not null,
  arquivo_path text not null,
  observacao varchar(300),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  resposta varchar(300),
  afastamento_id uuid references public.afastamentos(id) on delete set null,
  analisado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint atestados_periodo check (fim >= inicio)
);
create index atestados_empresa_idx on public.atestados (empresa_id, status, created_at);
grant select on public.atestados to authenticated;
grant all on public.atestados to service_role;
alter table public.atestados enable row level security;
create policy "Atestados visiveis a empresa e ao funcionario" on public.atestados for select
  to authenticated using (empresa_id = public.my_empresa_id() or funcionario_id = public.my_funcionario_id());

-- ===== Comunica RH =====
create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  titulo varchar(120) not null,
  mensagem varchar(4000) not null,
  -- Vazio = todos os funcionários; preenchido = só aquele departamento.
  departamento varchar(80),
  importante boolean not null default false,
  created_at timestamptz not null default now()
);
create index comunicados_empresa_idx on public.comunicados (empresa_id, created_at desc);
grant select, insert, delete on public.comunicados to authenticated;
grant all on public.comunicados to service_role;
alter table public.comunicados enable row level security;
create policy "Comunicados geridos pela empresa" on public.comunicados for all to authenticated
  using (empresa_id = public.my_empresa_id()) with check (empresa_id = public.my_empresa_id());
create policy "Comunicados visiveis aos funcionarios" on public.comunicados for select
  to authenticated using (
    empresa_id = public.my_funcionario_empresa_id()
    and public.my_funcionario_id() is not null
    and (departamento is null or departamento = public.my_funcionario_departamento()));

create table public.comunicados_leitura (
  comunicado_id uuid not null references public.comunicados(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  lido_em timestamptz not null default now(),
  primary key (comunicado_id, funcionario_id)
);
grant select, insert on public.comunicados_leitura to authenticated;
grant all on public.comunicados_leitura to service_role;
alter table public.comunicados_leitura enable row level security;
create policy "Leitura registrada pelo proprio funcionario" on public.comunicados_leitura for insert
  to authenticated with check (
    funcionario_id = public.my_funcionario_id()
    and exists (select 1 from public.comunicados c where c.id = comunicado_id));
create policy "Leituras visiveis ao funcionario e a empresa" on public.comunicados_leitura for select
  to authenticated using (
    funcionario_id = public.my_funcionario_id()
    or exists (select 1 from public.comunicados c
               where c.id = comunicado_id and c.empresa_id = public.my_empresa_id()));

-- ===== Arquivos privados: atestados e fotos de perfil =====
insert into storage.buckets (id, name, public) values ('atestados', 'atestados', false)
on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('perfil', 'perfil', false)
on conflict (id) do update set public = false;
-- Caminho: <empresa_id>/<funcionario_id>/arquivo. Gravação só pelo servidor.
create policy "Atestados e perfil legiveis pela empresa ou pelo dono" on storage.objects for select
  to authenticated using (
    bucket_id in ('atestados', 'perfil') and (
      (storage.foldername(name))[1] = public.my_empresa_id()::text
      or (storage.foldername(name))[2] = public.my_funcionario_id()::text));

-- ===== Defesa em profundidade =====
-- O Supabase concede tudo nas tabelas novas por padrão; a RLS já bloqueia, mas aqui ficam só os
-- privilégios que o navegador realmente usa.
revoke all on public.banco_horas_lancamentos, public.atestados, public.comunicados,
  public.comunicados_leitura from anon;
revoke all on public.banco_horas_lancamentos, public.atestados, public.comunicados,
  public.comunicados_leitura from authenticated;
grant select, insert, delete on public.banco_horas_lancamentos to authenticated;
grant select on public.atestados to authenticated;
grant select, insert, delete on public.comunicados to authenticated;
grant select, insert on public.comunicados_leitura to authenticated;
revoke all on public.afastamentos, public.ferias from anon;
revoke truncate, references, trigger on public.afastamentos, public.ferias from authenticated;
