-- Rastrear qual usuário enviou cada mensagem na Caixa de Entrada (Meta WABA)
-- Permite metrificar tempo de resposta e identificar quem atuou no chat.

ALTER TABLE public.meta_inbox_messages
  ADD COLUMN IF NOT EXISTS sent_by_user_id UUID REFERENCES saas.usuarios(id) ON DELETE SET NULL;

-- Index para consultas de métricas por usuário
CREATE INDEX IF NOT EXISTS idx_meta_inbox_messages_sent_by_user
  ON public.meta_inbox_messages(sent_by_user_id)
  WHERE sent_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.meta_inbox_messages.sent_by_user_id IS 'UUID do usuário que enviou a mensagem (saas.usuarios). NULL para mensagens recebidas.';
