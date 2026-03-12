-- Tabela de alertas internos do sistema
CREATE TABLE IF NOT EXISTS saas.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES saas.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('info', 'warning', 'error', 'success')),
  categoria text NOT NULL CHECK (categoria IN ('whatsapp', 'users', 'training', 'meetings', 'analytics', 'system')),
  titulo text NOT NULL,
  mensagem text,
  lido boolean NOT NULL DEFAULT false,
  evento_id text, -- webhook event id que gerou o alerta
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_alertas_empresa_lido ON saas.alertas(empresa_id, lido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_empresa_cat ON saas.alertas(empresa_id, categoria, created_at DESC);

-- RLS
ALTER TABLE saas.alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_empresa" ON saas.alertas
  FOR ALL USING (empresa_id IN (
    SELECT u.empresa_id FROM saas.usuarios u WHERE u.auth_uid = auth.uid()
  ));

-- Função para contar alertas não lidos
CREATE OR REPLACE FUNCTION saas.contar_alertas_nao_lidos(p_empresa_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = saas
AS $$
  SELECT count(*)::int FROM saas.alertas WHERE empresa_id = p_empresa_id AND lido = false;
$$;

GRANT EXECUTE ON FUNCTION saas.contar_alertas_nao_lidos(uuid) TO authenticated;

-- Função para marcar alertas como lidos
CREATE OR REPLACE FUNCTION saas.marcar_alertas_lidos(p_empresa_id uuid, p_ids uuid[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_ids IS NULL THEN
    -- Marcar todos como lidos
    UPDATE saas.alertas SET lido = true WHERE empresa_id = p_empresa_id AND lido = false;
  ELSE
    -- Marcar apenas os especificados
    UPDATE saas.alertas SET lido = true WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND lido = false;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION saas.marcar_alertas_lidos(uuid, uuid[]) TO authenticated;

-- Grant acesso à tabela
GRANT SELECT, INSERT, UPDATE, DELETE ON saas.alertas TO authenticated;
