-- Configuração de geração de tickets por conta da Caixa de Entrada.
-- Permite definir se conversas nessa conta devem gerar tickets no CRM,
-- e em qual pipeline/estágio serão criados.

ALTER TABLE public.meta_inbox_accounts
  ADD COLUMN IF NOT EXISTS ticket_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_pipeline_id UUID REFERENCES saas.crm_pipelines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_estagio_id UUID REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_prioridade TEXT NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN public.meta_inbox_accounts.ticket_enabled IS 'Se true, conversas nesta conta podem gerar tickets no CRM.';
COMMENT ON COLUMN public.meta_inbox_accounts.ticket_pipeline_id IS 'Pipeline de tickets onde os tickets serão criados.';
COMMENT ON COLUMN public.meta_inbox_accounts.ticket_estagio_id IS 'Estágio inicial dos tickets criados.';
COMMENT ON COLUMN public.meta_inbox_accounts.ticket_prioridade IS 'Prioridade padrão dos tickets: low, medium, high, urgent.';
