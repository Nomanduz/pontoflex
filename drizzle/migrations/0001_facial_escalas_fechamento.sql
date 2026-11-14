alter table public.funcionarios
  add column escala text not null default '5x2',
  add column dias_semana int[],
  add column escala_inicio date,
  add column hora_entrada time not null default '08:00',
  add column hora_saida_almoco time not null default '12:00',
  add column hora_retorno_almoco time not null default '13:00',
  add column hora_saida time not null default '17:00',
  add column foto_path text;

alter table public.pontos
  add column selfie_path text,
  add column face_status text,
  add column face_confianca numeric;

-- Punches now go only through the server (face check happens there)
drop policy if exists "Pontos insertable by self" on public.pontos;
revoke insert on public.pontos from authenticated;

create or replace function public.pontos_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_last public.ponto_tipo;
  v_last_at timestamptz;
  v_expected public.ponto_tipo;
  v_ativo boolean;
begin
  select empresa_id, ativo into new.empresa_id, v_ativo from public.funcionarios where id = new.funcionario_id;
  if v_ativo is not true then raise exception 'Funcionário inativo'; end if;
  new.data_hora := now();
  select tipo, data_hora into v_last, v_last_at from public.pontos
    where funcionario_id = new.funcionario_id
    order by data_hora desc limit 1;
  if v_last is null or now() - v_last_at > interval '26 hours' then
    v_expected := 'ENTRADA';
  elsif v_last = 'SAIDA' then
    if now() - v_last_at < interval '1 hour' then raise exception 'Jornada já foi encerrada'; end if;
    v_expected := 'ENTRADA';
  else
    v_expected := case v_last
      when 'ENTRADA' then 'SAIDA_ALMOCO'
      when 'SAIDA_ALMOCO' then 'RETORNO_ALMOCO'
      else 'SAIDA' end;
  end if;
  if new.tipo <> v_expected then raise exception 'Próxima marcação esperada: %', v_expected; end if;
  return new;
end $$;

create table public.fechamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  resumo jsonb not null,
  hash text not null,
  fechado_em timestamptz not null default now(),
  func_assinado_em timestamptz,
  func_ip text,
  func_latitude numeric,
  func_longitude numeric,
  empresa_assinado_em timestamptz,
  empresa_ip text,
  unique (funcionario_id, periodo_inicio)
);
grant select on public.fechamentos to authenticated;
grant all on public.fechamentos to service_role;
alter table public.fechamentos enable row level security;
create policy "Fechamentos readable by admin or self" on public.fechamentos for select to authenticated
  using (empresa_id = public.my_empresa_id() or funcionario_id = public.my_funcionario_id());

create policy "Faces readable by empresa or self" on storage.objects for select to authenticated
  using (bucket_id = 'faces' and ((storage.foldername(name))[1] = public.my_empresa_id()::text
    or (storage.foldername(name))[2] = public.my_funcionario_id()::text));