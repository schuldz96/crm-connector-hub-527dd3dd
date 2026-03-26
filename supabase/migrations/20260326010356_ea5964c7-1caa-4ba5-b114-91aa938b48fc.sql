
-- Tabela de contas/caixas de entrada da Meta (WhatsApp Business API oficial)
CREATE TABLE public.meta_inbox_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'permanent', -- 'permanent' | 'oauth'
  phone_display TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'active' | 'pending' | 'error'
  webhook_verify_token TEXT DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_inbox_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_inbox_accounts_select" ON public.meta_inbox_accounts
  FOR SELECT USING (true);

CREATE POLICY "meta_inbox_accounts_insert" ON public.meta_inbox_accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "meta_inbox_accounts_update" ON public.meta_inbox_accounts
  FOR UPDATE USING (true);

CREATE POLICY "meta_inbox_accounts_delete" ON public.meta_inbox_accounts
  FOR DELETE USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_meta_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_meta_inbox_accounts_updated_at
  BEFORE UPDATE ON public.meta_inbox_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_meta_inbox_updated_at();
