-- Cenários de treinamento de vendas (simulação de voz com IA)
CREATE TABLE IF NOT EXISTS saas.training_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  persona TEXT,                          -- perfil do cliente simulado
  dificuldade TEXT DEFAULT 'medium',     -- easy, medium, hard
  pontos_foco TEXT[] DEFAULT '{}',       -- o que praticar
  pontos_evitar TEXT[] DEFAULT '{}',     -- o que evitar
  script JSONB,                          -- roteiro por fases (opcional)
  criado_por UUID REFERENCES saas.usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_scenarios_empresa ON saas.training_scenarios(empresa_id);

ALTER TABLE saas.training_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_scenarios_all" ON saas.training_scenarios FOR ALL USING (true) WITH CHECK (true);
