-- Add modulo column to agentes_ia to separate meetings vs whatsapp agent trees
ALTER TABLE saas.agentes_ia
  ADD COLUMN IF NOT EXISTS modulo text NOT NULL DEFAULT 'meetings'
  CHECK (modulo IN ('meetings', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_agentes_ia_modulo ON saas.agentes_ia(empresa_id, modulo);
