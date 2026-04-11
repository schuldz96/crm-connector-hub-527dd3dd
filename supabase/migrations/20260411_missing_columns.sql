-- ============================================================================
-- Migration: Add columns that exist in production but were missing from migrations
-- Date: 2026-04-11
-- ============================================================================

-- crm.estagio_ia_config — columns added directly in production
ALTER TABLE crm.estagio_ia_config ADD COLUMN IF NOT EXISTS nome_ia text DEFAULT '';
ALTER TABLE crm.estagio_ia_config ADD COLUMN IF NOT EXISTS modelo_ia text DEFAULT 'gpt-4o-mini';
ALTER TABLE crm.estagio_ia_config ADD COLUMN IF NOT EXISTS temperatura numeric DEFAULT 0.7;
ALTER TABLE crm.estagio_ia_config ADD COLUMN IF NOT EXISTS instancia_modo text DEFAULT 'owner';

-- ai.configuracoes — palavras_proibidas
ALTER TABLE ai.configuracoes ADD COLUMN IF NOT EXISTS palavras_proibidas jsonb DEFAULT '[]'::jsonb;
