-- Histórico de proprietários de tickets.
-- Registra cada troca de proprietário com timestamps para calcular
-- tempo de permanência de cada atendente.

CREATE TABLE IF NOT EXISTS saas.crm_ticket_owner_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES saas.crm_tickets(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES saas.usuarios(id) ON DELETE SET NULL,
  usuario_nome TEXT, -- snapshot do nome no momento da atribuição
  atribuido_por UUID REFERENCES saas.usuarios(id) ON DELETE SET NULL,
  inicio_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fim_em TIMESTAMPTZ, -- NULL = proprietário atual
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_owner_history_ticket ON saas.crm_ticket_owner_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_owner_history_user ON saas.crm_ticket_owner_history(usuario_id);

COMMENT ON TABLE saas.crm_ticket_owner_history IS 'Auditoria de trocas de proprietário em tickets. Permite calcular tempo de atendimento por pessoa.';
