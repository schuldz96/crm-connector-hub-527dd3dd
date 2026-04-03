-- Tabela de configuração de IA por estágio do pipeline (Deals e Tickets).
-- Referenciada por StageAIConfigModal nos CRMDealsPage e CRMTicketsPage.

CREATE TABLE IF NOT EXISTS saas.crm_estagio_ia_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES saas.empresas(id) ON DELETE CASCADE,
  estagio_id UUID NOT NULL REFERENCES saas.crm_pipeline_estagios(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'evolution',
  instancia_id TEXT,
  prompt_sistema TEXT DEFAULT '',
  auto_complemento TEXT DEFAULT '',
  mensagem_boas_vindas JSONB DEFAULT '{"enabled":false,"type":"text","text":""}'::jsonb,
  modo_inicio TEXT NOT NULL DEFAULT 'immediate',
  delay_digitacao INTEGER NOT NULL DEFAULT 10,
  delay_resposta INTEGER NOT NULL DEFAULT 10,
  perguntas JSONB DEFAULT '[]'::jsonb,
  followups JSONB DEFAULT '[]'::jsonb,
  rag_ativo BOOLEAN NOT NULL DEFAULT false,
  rag_fonte TEXT DEFAULT '',
  rag_max_turnos INTEGER NOT NULL DEFAULT 10,
  transicoes JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (estagio_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_estagio_ia_config_empresa ON saas.crm_estagio_ia_config(empresa_id);
CREATE INDEX IF NOT EXISTS idx_crm_estagio_ia_config_estagio ON saas.crm_estagio_ia_config(estagio_id);

-- Grants
GRANT ALL ON saas.crm_estagio_ia_config TO anon, authenticated, service_role;

-- Disable RLS (same pattern as other CRM tables)
ALTER TABLE saas.crm_estagio_ia_config DISABLE ROW LEVEL SECURITY;

-- Trigger para atualizar atualizado_em
CREATE TRIGGER trg_crm_estagio_ia_config_atualizado_em
  BEFORE UPDATE ON saas.crm_estagio_ia_config
  FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();

COMMENT ON TABLE saas.crm_estagio_ia_config IS 'Configuração de IA por estágio de pipeline (Deals e Tickets). Cada estágio pode ter seu próprio agente IA com prompt, follow-ups, perguntas e transições.';

-- Notificar PostgREST para recarregar schema
NOTIFY pgrst, 'reload schema';
