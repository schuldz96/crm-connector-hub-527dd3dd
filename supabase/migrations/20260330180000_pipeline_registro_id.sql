-- Add internal registration ID to pipelines (format: X12345678Y - 1 letter + 8 digits + 1 letter)
ALTER TABLE saas.crm_pipelines ADD COLUMN IF NOT EXISTS registro_id text;

-- Function to auto-generate registro_id
CREATE OR REPLACE FUNCTION saas.gerar_registro_id_pipeline()
RETURNS trigger AS $$
DECLARE
  letra_inicio char(1);
  letra_fim char(1);
  numeros text;
BEGIN
  letra_inicio := chr(65 + floor(random() * 26)::int);
  letra_fim := chr(65 + floor(random() * 26)::int);
  numeros := lpad(floor(random() * 100000000)::text, 8, '0');
  NEW.registro_id := letra_inicio || numeros || letra_fim;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-generation on insert
DROP TRIGGER IF EXISTS trg_pipeline_registro_id ON saas.crm_pipelines;
CREATE TRIGGER trg_pipeline_registro_id
  BEFORE INSERT ON saas.crm_pipelines
  FOR EACH ROW
  WHEN (NEW.registro_id IS NULL)
  EXECUTE FUNCTION saas.gerar_registro_id_pipeline();

-- Generate for existing pipelines
UPDATE saas.crm_pipelines
SET registro_id = chr(65 + floor(random() * 26)::int)
  || lpad(floor(random() * 100000000)::text, 8, '0')
  || chr(65 + floor(random() * 26)::int)
WHERE registro_id IS NULL;

-- Enforce uniqueness
ALTER TABLE saas.crm_pipelines ALTER COLUMN registro_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_pipelines_registro_id_key ON saas.crm_pipelines(registro_id);
