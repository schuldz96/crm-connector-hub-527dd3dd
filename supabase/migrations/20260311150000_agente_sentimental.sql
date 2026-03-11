-- Add 'sentimental' agent type to agentes_ia
-- This allows flexible agent trees with sentiment analysis agents

-- Drop old CHECK constraint and recreate with new type
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the actual constraint name
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'saas.agentes_ia'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%tipo%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE saas.agentes_ia DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE saas.agentes_ia
  ADD CONSTRAINT agentes_ia_tipo_check
  CHECK (tipo IN ('gerente', 'classificador', 'avaliador', 'sentimental'));
