-- Flag for manually uploaded meetings (audit)
ALTER TABLE saas.reunioes ADD COLUMN IF NOT EXISTS auditoria_manual BOOLEAN DEFAULT false;
ALTER TABLE saas.reunioes ADD COLUMN IF NOT EXISTS arquivo_original TEXT;
