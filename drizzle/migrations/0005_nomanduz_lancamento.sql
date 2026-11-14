-- PontoFlex 1.0 (NOMANDUZ - TECH and IA): correções de segurança e estrutura para lançamento.

-- ===== Papéis =====
alter type public.app_role add value if not exists 'superadmin';

-- ===== Armazenamento privado das fotos =====
insert into storage.buckets (id, name, public)
values ('faces', 'faces', false)
on conflict (id) do update set public = false;

-- ===== Empresas: CPF ou CNPJ, ciclo de teste, cerca geográfica =====
alter table public.empresas rename column cnpj to documento;
alter table public.empresas
  add column tipo_documento text not null default 'CNPJ' check (tipo_documento in ('CPF', 'CNPJ')),
  add column responsavel varchar(255),
  add column telefone varchar(20),
  add column status text not null default 'teste' check (status in ('teste', 'ativa', 'suspensa')),
  add column teste_ate timestamptz,
  add column latitude numeric(10, 7),
  add column longitude numeric(10, 7),
  add column raio_m int check (raio_m is null or raio_m between 50 and 5000);

-- Hashes SHA-256 sem sal deixam de valer: as senhas mestras passam a usar scrypt com sal.
update public.empresas set senha_mestra_leitura = null, senha_mestra_cadastro = null;

-- O administrador só altera dados cadastrais simples pelo navegador; o resto passa pelo servidor.
revoke update on public.empresas from authenticated;
grant update (razao_social, responsavel, telefone) on public.empresas to authenticated;

-- ===== Funcionários: CPF e matrícula únicos por empresa =====
alter table public.funcionarios drop constraint if exists funcionarios_cpf_key;
alter table public.funcionarios add constraint funcionarios_empresa_cpf_key unique (empresa_id, cpf);
update public.funcionarios set matricula = left(replace(id::text, '-', ''), 8) where matricula is null or btrim(matricula) = '';
alter table public.funcionarios alter column matricula set not null;
create unique index funcionarios_empresa_matricula_key on public.funcionarios (empresa_id, lower(matricula));

alter table public.funcionarios
  add column face_id text,
  add column foto_status text not null default 'sem_foto' check (foto_status in ('sem_foto', 'pendente', 'aprovada', 'recusada')),
  add column foto_enviada_em timestamptz,
  add column consentimento_biometria_em timestamptz,
  add column desativado_em timestamptz;
update public.funcionarios set foto_status = 'pendente' where foto_path is not null;

-- Nada de excluir/alterar campos sensíveis direto do navegador.
drop policy if exists "Funcionarios deletable by admin" on public.funcionarios;
revoke update, delete on public.funcionarios from authenticated;
grant update (nome, telefone, cargo, matricula, escala, dias_semana, escala_inicio,
  hora_entrada, hora_saida_almoco, hora_retorno_almoco, hora_saida) on public.funcionarios to authenticated;

-- ===== Registros de ponto nunca somem junto com o funcionário (guarda legal) =====
alter table public.pontos drop constraint if exists pontos_funcionario_id_fkey;
alter table public.pontos add constraint pontos_funcionario_id_fkey
  foreign key (funcionario_id) references public.funcionarios(id); -- NO ACTION: bloqueia apagar só o funcionário, permite apagar a empresa inteira
alter table public.fechamentos drop constraint if exists fechamentos_funcionario_id_fkey;
alter table public.fechamentos add constraint fechamentos_funcionario_id_fkey
  foreign key (funcionario_id) references public.funcionarios(id); -- NO ACTION: bloqueia apagar só o funcionário, permite apagar a empresa inteira
alter table public.solicitacoes_ponto drop constraint if exists solicitacoes_ponto_funcionario_id_fkey;
alter table public.solicitacoes_ponto add constraint solicitacoes_ponto_funcionario_id_fkey
  foreign key (funcionario_id) references public.funcionarios(id); -- NO ACTION: bloqueia apagar só o funcionário, permite apagar a empresa inteira
alter table public.terminal_logs drop constraint if exists terminal_logs_funcionario_id_fkey;
alter table public.terminal_logs add constraint terminal_logs_funcionario_id_fkey
  foreign key (funcionario_id) references public.funcionarios(id) on delete set null;
alter table public.terminal_logs drop constraint if exists terminal_logs_empresa_id_fkey;
alter table public.terminal_logs add constraint terminal_logs_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete cascade;
alter table public.codigos_senha_empresa add constraint codigos_senha_empresa_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete cascade;

alter table public.pontos
  add column distancia_m int,
  add column fora_do_raio boolean not null default false;

-- ===== Assinatura vinculada ao conteúdo conferido =====
alter table public.fechamentos
  add column func_hash_assinado text,
  add column empresa_hash_assinado text;

-- ===== Limite de tentativas (login, terminal, cadastro) =====
create table public.tentativas (
  id bigserial primary key,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index tentativas_chave_idx on public.tentativas (chave, criado_em);
grant all on public.tentativas to service_role;
grant usage, select on sequence public.tentativas_id_seq to service_role;
alter table public.tentativas enable row level security;

-- ===== Solicitações de cadastro de empresas (fila da Nomanduz) =====
create table public.solicitacoes_cadastro (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null check (tipo_documento in ('CPF', 'CNPJ')),
  documento varchar(18) not null,
  razao_social varchar(255) not null,
  responsavel varchar(255) not null,
  email varchar(255) not null,
  telefone varchar(20),
  qtd_funcionarios int,
  mensagem text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'ativada')),
  codigo_hash text,
  codigo_expira_em timestamptz,
  empresa_id uuid references public.empresas(id) on delete set null,
  observacao text,
  ip text,
  created_at timestamptz not null default now(),
  analisado_em timestamptz,
  ativado_em timestamptz
);
create index solicitacoes_cadastro_status_idx on public.solicitacoes_cadastro (status, created_at desc);
grant all on public.solicitacoes_cadastro to service_role;
alter table public.solicitacoes_cadastro enable row level security;

-- ===== Superadmin (equipe Nomanduz) enxerga a plataforma =====
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role::text = 'superadmin')
$$;
grant select on public.solicitacoes_cadastro to authenticated;
create policy "Solicitacoes cadastro readable by superadmin" on public.solicitacoes_cadastro
  for select to authenticated using (public.is_superadmin());
create policy "Empresas readable by superadmin" on public.empresas
  for select to authenticated using (public.is_superadmin());

-- Funcionário desativado não lê mais dados da empresa.
create or replace function public.my_funcionario_empresa_id()
returns uuid language sql stable security definer set search_path = public as $$
  select empresa_id from public.funcionarios where user_id = auth.uid() and ativo
$$;
