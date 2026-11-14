ALTER TABLE public.empresas
  ADD COLUMN senha_mestra_leitura text,
  ADD COLUMN senha_mestra_cadastro text;

CREATE TABLE public.terminal_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  funcionario_id uuid references public.funcionarios(id),
  acao text not null,
  detalhe text,
  data_hora timestamptz not null default now()
);

GRANT SELECT ON public.terminal_logs TO authenticated;
GRANT ALL ON public.terminal_logs TO service_role;

ALTER TABLE public.terminal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terminal logs readable by admin"
  ON public.terminal_logs FOR SELECT TO authenticated
  USING (empresa_id = my_empresa_id());