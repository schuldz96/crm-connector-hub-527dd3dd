-- Contato principal em negócios e tickets.
-- Define quem recebe as mensagens da IA quando há múltiplos contatos.

ALTER TABLE saas.crm_negocios ADD COLUMN IF NOT EXISTS contato_principal_id UUID REFERENCES saas.crm_contatos(id) ON DELETE SET NULL;
ALTER TABLE saas.crm_tickets ADD COLUMN IF NOT EXISTS contato_principal_id UUID REFERENCES saas.crm_contatos(id) ON DELETE SET NULL;

COMMENT ON COLUMN saas.crm_negocios.contato_principal_id IS 'Contato principal do negócio — destinatário das mensagens da IA';
COMMENT ON COLUMN saas.crm_tickets.contato_principal_id IS 'Contato principal do ticket — destinatário das mensagens da IA';

NOTIFY pgrst, 'reload schema';
