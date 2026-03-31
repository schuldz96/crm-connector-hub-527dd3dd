-- Add nome_interno (numeric 9-digit ID) to pipelines and stages

-- Pipelines
ALTER TABLE saas.crm_pipelines DROP COLUMN IF EXISTS registro_id CASCADE;
ALTER TABLE saas.crm_pipelines ADD COLUMN IF NOT EXISTS nome_interno bigint;

-- Stages
ALTER TABLE saas.crm_pipeline_estagios ADD COLUMN IF NOT EXISTS nome_interno bigint;

-- Auto-generation function (9-digit random numeric ID)
CREATE OR REPLACE FUNCTION saas.gerar_nome_interno()
RETURNS trigger AS $$
BEGIN
  NEW.nome_interno := floor(random() * 900000000 + 100000000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS trg_pipeline_nome_interno ON saas.crm_pipelines;
CREATE TRIGGER trg_pipeline_nome_interno
  BEFORE INSERT ON saas.crm_pipelines
  FOR EACH ROW WHEN (NEW.nome_interno IS NULL)
  EXECUTE FUNCTION saas.gerar_nome_interno();

DROP TRIGGER IF EXISTS trg_estagio_nome_interno ON saas.crm_pipeline_estagios;
CREATE TRIGGER trg_estagio_nome_interno
  BEFORE INSERT ON saas.crm_pipeline_estagios
  FOR EACH ROW WHEN (NEW.nome_interno IS NULL)
  EXECUTE FUNCTION saas.gerar_nome_interno();

-- Populate existing records
UPDATE saas.crm_pipelines SET nome_interno = floor(random() * 900000000 + 100000000)::bigint WHERE nome_interno IS NULL;
UPDATE saas.crm_pipeline_estagios SET nome_interno = floor(random() * 900000000 + 100000000)::bigint WHERE nome_interno IS NULL;

-- Enforce constraints
ALTER TABLE saas.crm_pipelines ALTER COLUMN nome_interno SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_pipelines_nome_interno_key ON saas.crm_pipelines(nome_interno);
ALTER TABLE saas.crm_pipeline_estagios ALTER COLUMN nome_interno SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_pipeline_estagios_nome_interno_key ON saas.crm_pipeline_estagios(nome_interno);
