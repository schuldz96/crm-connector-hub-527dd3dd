-- Allow multiple evaluations per meeting (one per agent)
-- Drop old UNIQUE that only allowed 1 eval per entity
ALTER TABLE saas.analises_ia DROP CONSTRAINT IF EXISTS analises_ia_contexto_entidade_uq;

-- New unique: 1 eval per entity per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_analises_ia_entidade_agente
ON saas.analises_ia (tipo_contexto, entidade_id, agente_avaliador_id)
WHERE agente_avaliador_id IS NOT NULL;

-- Non-unique index for querying all evals for an entity
CREATE INDEX IF NOT EXISTS idx_analises_ia_entidade
ON saas.analises_ia (tipo_contexto, entidade_id);
