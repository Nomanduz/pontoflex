-- Vínculo de trabalho: admissão, tipo de contrato, experiência, desligamento.
-- Afastamentos e férias (dias justificados que não contam como falta no espelho).
-- LGPD: nenhum campo de diagnóstico/CID é guardado; só o tipo do afastamento.

alter table public.funcionarios
  add column data_admissao date,
  add column tipo_contrato text not null default 'indeterminado'
    check (tipo_contrato in ('experiencia', 'indeterminado', 'determinado', 'estagio', 'aprendiz')),
  -- Experiência (CLT art. 445): até 90 dias, com no máximo uma prorrogação (art. 451).
  add column experiencia_dias int check (experiencia_dias between 1 and 90),
  add column experiencia_prorrogacao_dias int check (experiencia_prorrogacao_dias between 1 and 89),
  -- Prazo determinado, estágio, aprendiz: data prevista de término.
  add column contrato_fim date,
  add column data_desligamento date,
  add column motivo_desligamento text check (motivo_desligamento in (
    'sem_justa_causa', 'justa_causa', 'pedido_demissao', 'fim_experiencia', 'fim_contrato',
    'acordo', 'aposentadoria', 'falecimento', 'outro')),
  add column aviso_previo text check (aviso_previo in ('trabalhado', 'indenizado', 'dispensado', 'nao_se_aplica')),
  add column desligamento_obs varchar(500),
  add constraint funcionarios_experiencia_total check (
    coalesce(experiencia_dias, 0) + coalesce(experiencia_prorrogacao_dias, 0) <= 90);

-- O administrador edita os dados do contrato pelo navegador; desligamento só pelo servidor
-- (ele também bloqueia o acesso e apaga a biometria).
grant update (data_admissao, tipo_contrato, experiencia_dias, experiencia_prorrogacao_dias,
  contrato_fim) on public.funcionarios to authenticated;

-- ===== Afastamentos =====
create table public.afastamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id),
  tipo text not null check (tipo in (
    'atestado', 'auxilio_doenca', 'acidente_trabalho', 'licenca_maternidade',
    'licenca_paternidade', 'casamento', 'falecimento_familiar', 'doacao_sangue',
    'servico_militar', 'justica_eleitoral', 'suspensao', 'licenca_nao_remunerada', 'outro')),
  inicio date not null,
  fim date not null,
  observacao varchar(300),
  created_at timestamptz not null default now(),
  constraint afastamentos_periodo check (fim >= inicio)
);
create index afastamentos_func_idx on public.afastamentos (funcionario_id, inicio);
grant select, insert, update, delete on public.afastamentos to authenticated;
grant all on public.afastamentos to service_role;
alter table public.afastamentos enable row level security;
create policy "Afastamentos geridos pela empresa" on public.afastamentos for all to authenticated
  using (empresa_id = public.my_empresa_id()) with check (empresa_id = public.my_empresa_id());
create policy "Afastamentos visiveis ao proprio funcionario" on public.afastamentos for select
  to authenticated using (funcionario_id = public.my_funcionario_id());

-- ===== Férias =====
create table public.ferias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id),
  aquisitivo_inicio date not null,
  aquisitivo_fim date not null,
  inicio date not null,
  dias int not null check (dias between 5 and 30),
  -- Abono pecuniário (venda de até 1/3 das férias, CLT art. 143).
  abono_dias int not null default 0 check (abono_dias between 0 and 10),
  observacao varchar(300),
  created_at timestamptz not null default now()
);
create index ferias_func_idx on public.ferias (funcionario_id, inicio);
grant select, insert, update, delete on public.ferias to authenticated;
grant all on public.ferias to service_role;
alter table public.ferias enable row level security;
create policy "Ferias geridas pela empresa" on public.ferias for all to authenticated
  using (empresa_id = public.my_empresa_id()) with check (empresa_id = public.my_empresa_id());
create policy "Ferias visiveis ao proprio funcionario" on public.ferias for select
  to authenticated using (funcionario_id = public.my_funcionario_id());

-- O funcionário precisa pertencer à empresa informada.
create or replace function public.vinculo_mesma_empresa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.funcionarios
                 where id = new.funcionario_id and empresa_id = new.empresa_id) then
    raise exception 'Funcionário não pertence a esta empresa';
  end if;
  return new;
end $$;
create trigger afastamentos_mesma_empresa before insert or update on public.afastamentos
  for each row execute function public.vinculo_mesma_empresa();
create trigger ferias_mesma_empresa before insert or update on public.ferias
  for each row execute function public.vinculo_mesma_empresa();
