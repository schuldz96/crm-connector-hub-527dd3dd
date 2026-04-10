-- ============================================================================
-- Migration: Trial por módulo + garantir acesso enterprise para org owner
-- Date: 2026-04-09
-- ============================================================================

-- 1. Add trial_modulos to assinaturas (modules being trialed individually)
--    Format: JSONB array of { modulo: string, expira_em: timestamptz }
ALTER TABLE admin.assinaturas
  ADD COLUMN IF NOT EXISTS trial_modulos jsonb DEFAULT '[]'::jsonb;

-- 2. Ensure the enterprise plan exists and get its ID
DO $$
DECLARE
  enterprise_plan_id uuid;
  org_id text;
BEGIN
  -- Get enterprise plan
  SELECT id INTO enterprise_plan_id FROM admin.planos WHERE codigo = 'enterprise' LIMIT 1;

  IF enterprise_plan_id IS NULL THEN
    INSERT INTO admin.planos (nome, codigo, descricao, preco_mensal, preco_anual, preco_por_usuario, min_usuarios, max_usuarios, max_instancias_whatsapp, max_avaliacoes_ia_mes, storage_mb, permite_venda_modulo, ativo)
    VALUES ('Enterprise', 'enterprise', 'Plano completo com todos os módulos', 997, 9574, 249, 10, 9999, 9999, 999999, 102400, true, true)
    RETURNING id INTO enterprise_plan_id;
  END IF;

  -- Find org for gmail.com domain
  SELECT org INTO org_id FROM core.empresas WHERE dominio = 'gmail.com' LIMIT 1;

  -- If org exists, ensure it has an active enterprise subscription
  IF org_id IS NOT NULL THEN
    -- Check if subscription already exists
    IF NOT EXISTS (SELECT 1 FROM admin.assinaturas WHERE org = org_id AND status = 'ativa') THEN
      INSERT INTO admin.assinaturas (org, plano_id, status, ciclo, inicio_em)
      VALUES (org_id, enterprise_plan_id, 'ativa', 'anual', now());
    ELSE
      -- Update existing subscription to enterprise
      UPDATE admin.assinaturas
      SET plano_id = enterprise_plan_id, status = 'ativa'
      WHERE org = org_id AND status = 'ativa';
    END IF;
  END IF;
END $$;
