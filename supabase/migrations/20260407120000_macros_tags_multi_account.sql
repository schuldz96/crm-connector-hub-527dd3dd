-- Migrar macros e tags para suportar múltiplas caixas de entrada
-- account_id (single) → account_ids (array)

-- Macros
ALTER TABLE public.meta_inbox_macros ADD COLUMN IF NOT EXISTS account_ids UUID[] DEFAULT '{}';
UPDATE public.meta_inbox_macros SET account_ids = ARRAY[account_id] WHERE account_ids = '{}' AND account_id IS NOT NULL;
ALTER TABLE public.meta_inbox_macros ALTER COLUMN account_id DROP NOT NULL;

-- Tags
ALTER TABLE public.meta_inbox_tags ADD COLUMN IF NOT EXISTS account_ids UUID[] DEFAULT '{}';
UPDATE public.meta_inbox_tags SET account_ids = ARRAY[account_id] WHERE account_ids = '{}' AND account_id IS NOT NULL;
ALTER TABLE public.meta_inbox_tags ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE public.meta_inbox_tags DROP CONSTRAINT IF EXISTS meta_inbox_tags_account_id_nome_key;
ALTER TABLE public.meta_inbox_tags ADD CONSTRAINT meta_inbox_tags_empresa_nome_key UNIQUE(empresa_id, nome);

-- Index para busca por array contains
CREATE INDEX IF NOT EXISTS idx_macros_account_ids ON public.meta_inbox_macros USING GIN(account_ids);
CREATE INDEX IF NOT EXISTS idx_tags_account_ids ON public.meta_inbox_tags USING GIN(account_ids);
