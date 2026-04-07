-- Macros por caixa de entrada (account)
-- Acionadas por /nome no input de mensagem

CREATE TABLE IF NOT EXISTS public.meta_inbox_macros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,                  -- atalho (ex: "boas_vindas")
  tipo TEXT NOT NULL DEFAULT 'text',   -- text, image, audio, document
  conteudo TEXT,                       -- texto da mensagem
  media_url TEXT,                      -- URL da mídia (image/audio/doc)
  media_nome TEXT,                     -- nome do arquivo original
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macros_account ON public.meta_inbox_macros(account_id);

ALTER TABLE public.meta_inbox_macros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "macros_all" ON public.meta_inbox_macros FOR ALL USING (true) WITH CHECK (true);

-- Tags predefinidas por caixa de entrada (account)
-- As conversas usam TEXT[] tags, aqui definimos as opções disponíveis + cores

CREATE TABLE IF NOT EXISTS public.meta_inbox_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#8B5CF6',  -- cor hex para o badge
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_tags_account ON public.meta_inbox_tags(account_id);

ALTER TABLE public.meta_inbox_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_all" ON public.meta_inbox_tags FOR ALL USING (true) WITH CHECK (true);
