-- Memória de conversas IA do CRM.
-- Armazena contexto (mensagens trocadas) por negócio/ticket para manter
-- continuidade nas interações da IA com o contato principal.

CREATE TABLE IF NOT EXISTS saas.crm_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES saas.empresas(id) ON DELETE CASCADE,
  entidade_tipo TEXT NOT NULL, -- 'deal' ou 'ticket'
  entidade_id UUID NOT NULL,
  estagio_id UUID REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL,
  contato_id UUID REFERENCES saas.crm_contatos(id) ON DELETE SET NULL,
  contato_telefone TEXT,
  provider TEXT NOT NULL DEFAULT 'evolution', -- 'evolution' ou 'meta'
  instancia TEXT, -- nome da instância Evolution ou account_id Meta
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed'
  mensagens JSONB NOT NULL DEFAULT '[]'::jsonb, -- array de {role, content, timestamp}
  total_mensagens INTEGER NOT NULL DEFAULT 0,
  ultima_mensagem_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_ai_conv_entidade ON saas.crm_ai_conversations(entidade_tipo, entidade_id, estagio_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_conv_empresa ON saas.crm_ai_conversations(empresa_id);
CREATE INDEX IF NOT EXISTS idx_crm_ai_conv_contato ON saas.crm_ai_conversations(contato_id);

GRANT ALL ON saas.crm_ai_conversations TO anon, authenticated, service_role;
ALTER TABLE saas.crm_ai_conversations DISABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_crm_ai_conv_atualizado_em
  BEFORE UPDATE ON saas.crm_ai_conversations
  FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();

COMMENT ON TABLE saas.crm_ai_conversations IS 'Memória de conversas IA do CRM. Uma conversa por entidade+estágio com histórico de mensagens para manter contexto.';

NOTIFY pgrst, 'reload schema';
