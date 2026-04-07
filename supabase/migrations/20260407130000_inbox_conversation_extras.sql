-- Campos extras para conversas: fixar, silenciar, favoritar
ALTER TABLE public.meta_inbox_conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;
ALTER TABLE public.meta_inbox_conversations ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE public.meta_inbox_conversations ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT false;
ALTER TABLE public.meta_inbox_conversations ADD COLUMN IF NOT EXISTS favorited BOOLEAN DEFAULT false;
