ALTER TABLE public.funcionarios ADD COLUMN senha_alterada_em timestamptz;
ALTER TABLE public.pontos ADD COLUMN origem text NOT NULL DEFAULT 'registro', ADD COLUMN solicitacao_id uuid;

CREATE TABLE public.solicitacoes_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo public.ponto_tipo NOT NULL,
  data_hora timestamptz NOT NULL,
  motivo text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  observacao text,
  analisado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.solicitacoes_ponto TO authenticated;
GRANT ALL ON public.solicitacoes_ponto TO service_role;
ALTER TABLE public.solicitacoes_ponto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Solicitacoes readable by admin or self" ON public.solicitacoes_ponto FOR SELECT TO authenticated
  USING (empresa_id = public.my_empresa_id() OR funcionario_id = public.my_funcionario_id());

CREATE OR REPLACE FUNCTION public.pontos_validate()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_last public.ponto_tipo;
  v_last_at timestamptz;
  v_expected public.ponto_tipo;
  v_ativo boolean;
begin
  select empresa_id, ativo into new.empresa_id, v_ativo from public.funcionarios where id = new.funcionario_id;
  if v_ativo is not true then raise exception 'Funcionário inativo'; end if;
  -- lançamento autorizado posteriormente: mantém o horário informado
  if new.origem = 'ajuste' then
    if new.solicitacao_id is null then raise exception 'Ajuste sem solicitação'; end if;
    return new;
  end if;
  new.origem := 'registro';
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
end $function$;