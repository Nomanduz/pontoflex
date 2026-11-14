CREATE TABLE public.codigos_senha_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo_hash text NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  usado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.codigos_senha_empresa TO service_role;
ALTER TABLE public.codigos_senha_empresa ENABLE ROW LEVEL SECURITY;