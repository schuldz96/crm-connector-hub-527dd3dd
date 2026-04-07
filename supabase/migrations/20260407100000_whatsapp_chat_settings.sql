-- WhatsApp Chat Settings: responsável (owner) e nome customizado por conversa
-- Usa chave composta (empresa_id, instancia, telefone) para identificar um chat único

CREATE TABLE IF NOT EXISTS saas.whatsapp_chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  instancia TEXT NOT NULL,           -- nome da instância Evolution
  telefone TEXT NOT NULL,            -- número do contato (remoteJid sem @s.whatsapp.net)
  responsavel_id UUID REFERENCES saas.usuarios(id) ON DELETE SET NULL,
  nome_customizado TEXT,             -- nome editado pelo usuário (sobrescreve push name)
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(empresa_id, instancia, telefone)
);

-- Index para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_settings_empresa_inst ON saas.whatsapp_chat_settings(empresa_id, instancia);
CREATE INDEX IF NOT EXISTS idx_chat_settings_responsavel ON saas.whatsapp_chat_settings(responsavel_id);

-- RLS desabilitado (segue padrão CRM)
ALTER TABLE saas.whatsapp_chat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_settings_all" ON saas.whatsapp_chat_settings FOR ALL USING (true) WITH CHECK (true);
