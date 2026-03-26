-- ═══════════════════════════════════════════════════════════════════════════════
-- Meta WhatsApp Business API — Mensagens, Conversas e Templates
-- Separado por phone_number_id e business_id (waba_id)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Conversas agrupadas por contato + conta Meta
CREATE TABLE IF NOT EXISTS public.meta_inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  contact_phone TEXT NOT NULL,        -- +5511999990001
  contact_name TEXT,                   -- Nome do contato (push name)
  contact_profile_pic TEXT,
  last_message TEXT,
  last_message_ts TIMESTAMPTZ,
  last_message_from_me BOOLEAN DEFAULT false,
  unread_count INTEGER DEFAULT 0,
  -- Janela de 24h: timestamp da última mensagem RECEBIDA do contato
  last_inbound_ts TIMESTAMPTZ,
  assigned_user_id UUID,               -- Quem está atendendo
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open',          -- open, closed, archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, contact_phone)
);

-- Mensagens individuais (recebidas e enviadas)
CREATE TABLE IF NOT EXISTS public.meta_inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.meta_inbox_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  -- Meta IDs
  wamid TEXT,                          -- WhatsApp Message ID (wa_msg_id)
  -- Direção
  from_me BOOLEAN NOT NULL DEFAULT false,
  from_phone TEXT,                     -- Quem enviou
  to_phone TEXT,                       -- Para quem
  -- Conteúdo
  msg_type TEXT NOT NULL DEFAULT 'text', -- text, image, audio, video, document, template, sticker, location, contacts, reaction
  body TEXT,                           -- Texto da mensagem
  caption TEXT,                        -- Legenda de mídia
  media_url TEXT,                      -- URL do arquivo de mídia
  media_mime TEXT,                     -- MIME type
  media_id TEXT,                       -- Meta media ID
  media_filename TEXT,
  -- Template (quando enviado como template)
  template_name TEXT,
  template_language TEXT,
  template_components JSONB,
  -- Status tracking (atualizado por webhook)
  status TEXT DEFAULT 'sent',          -- sent, delivered, read, failed
  error_code TEXT,                     -- Código de erro da Meta
  error_message TEXT,                  -- Descrição do erro
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cache local de templates da Meta (para exibição rápida)
CREATE TABLE IF NOT EXISTS public.meta_inbox_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  meta_template_id TEXT NOT NULL,      -- ID do template na Meta
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- APPROVED, PENDING, REJECTED, etc.
  category TEXT NOT NULL DEFAULT 'UTILITY',
  language TEXT NOT NULL DEFAULT 'pt_BR',
  components JSONB DEFAULT '[]',
  quality_score TEXT DEFAULT 'UNKNOWN', -- GREEN, YELLOW, RED, UNKNOWN
  rejected_reason TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (account_id, meta_template_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_conv_account ON public.meta_inbox_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_conv_empresa ON public.meta_inbox_conversations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_meta_conv_phone ON public.meta_inbox_conversations(account_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_meta_msg_conv ON public.meta_inbox_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meta_msg_wamid ON public.meta_inbox_messages(wamid);
CREATE INDEX IF NOT EXISTS idx_meta_msg_account ON public.meta_inbox_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_msg_status ON public.meta_inbox_messages(status);
CREATE INDEX IF NOT EXISTS idx_meta_tmpl_account ON public.meta_inbox_templates(account_id);

-- RLS
ALTER TABLE public.meta_inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_inbox_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_inbox_conversations_all" ON public.meta_inbox_conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "meta_inbox_messages_all" ON public.meta_inbox_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "meta_inbox_templates_all" ON public.meta_inbox_templates FOR ALL USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_meta_inbox_conversations_updated_at
  BEFORE UPDATE ON public.meta_inbox_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_meta_inbox_updated_at();
