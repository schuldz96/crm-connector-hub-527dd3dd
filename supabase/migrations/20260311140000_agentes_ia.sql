-- Multi-agent hierarchy for AI evaluation
-- Agents: gerente (orchestrator) -> classificador -> avaliador(es)

CREATE TABLE IF NOT EXISTS saas.agentes_ia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES saas.empresas(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES saas.agentes_ia(id) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('gerente', 'classificador', 'avaliador')),
  nome            text NOT NULL,
  descricao       text DEFAULT '',
  prompt_sistema  text NOT NULL DEFAULT '',
  criterios       jsonb NOT NULL DEFAULT '[]'::jsonb,
  modelo_ia       text DEFAULT 'gpt-4o-mini',
  temperatura     numeric(3,2) DEFAULT 0.0,
  ordem           int DEFAULT 0,
  ativo           boolean DEFAULT true,
  criado_em       timestamptz DEFAULT now(),
  atualizado_em   timestamptz DEFAULT now(),
  UNIQUE (empresa_id, parent_id, nome)
);

-- Files attached to agents (ebooks, reference docs)
CREATE TABLE IF NOT EXISTS saas.agente_arquivos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_id     uuid NOT NULL REFERENCES saas.agentes_ia(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES saas.empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  tipo_mime     text NOT NULL,
  tamanho       bigint DEFAULT 0,
  storage_path  text NOT NULL,
  texto_extraido text DEFAULT '',
  criado_em     timestamptz DEFAULT now()
);

-- Track which agent evaluated in analises_ia
ALTER TABLE saas.analises_ia
  ADD COLUMN IF NOT EXISTS agente_avaliador_id uuid REFERENCES saas.agentes_ia(id),
  ADD COLUMN IF NOT EXISTS tipo_reuniao_detectado text,
  ADD COLUMN IF NOT EXISTS chain_log jsonb;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agentes_ia_empresa ON saas.agentes_ia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agentes_ia_parent ON saas.agentes_ia(parent_id);
CREATE INDEX IF NOT EXISTS idx_agente_arquivos_agente ON saas.agente_arquivos(agente_id);

-- RLS
ALTER TABLE saas.agentes_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas.agente_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agentes_ia_all" ON saas.agentes_ia FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agente_arquivos_all" ON saas.agente_arquivos FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT ALL ON saas.agentes_ia TO authenticated, anon, service_role;
GRANT ALL ON saas.agente_arquivos TO authenticated, anon, service_role;
