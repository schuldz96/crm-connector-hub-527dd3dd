/**
 * One-time script: ensure enterprise plan + subscription exists for gmail.com org.
 * Run from browser console or via: node scripts/seed-enterprise.mjs
 *
 * Since we can't access the DB directly from CLI without service_role key,
 * this SQL needs to be run in the Supabase SQL Editor:
 *
 * Go to: https://supabase.com/dashboard/project/ugdojctvzifycofqzelf/sql/new
 * And paste the contents of: supabase/migrations/20260409_license_per_user_pricing.sql
 * Then paste: supabase/migrations/20260409_trial_modules_and_owner_access.sql
 */

console.log(`
=====================================================
  Para liberar acesso Enterprise para sua org:
=====================================================

1. Acesse o SQL Editor do Supabase:
   https://supabase.com/dashboard/project/ugdojctvzifycofqzelf/sql/new

2. Cole e execute o SQL abaixo:

-- Adicionar campos de pricing por usuario
ALTER TABLE admin.planos
  ADD COLUMN IF NOT EXISTS preco_por_usuario numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_usuarios int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS permite_venda_modulo boolean DEFAULT false;

-- Adicionar trial_modulos
ALTER TABLE admin.assinaturas
  ADD COLUMN IF NOT EXISTS trial_modulos jsonb DEFAULT '[]'::jsonb;

-- Criar/atualizar plano enterprise
DO $$
DECLARE
  enterprise_plan_id uuid;
  org_id text;
BEGIN
  SELECT id INTO enterprise_plan_id FROM admin.planos WHERE codigo = 'enterprise' LIMIT 1;

  IF enterprise_plan_id IS NULL THEN
    INSERT INTO admin.planos (nome, codigo, descricao, preco_mensal, preco_anual, preco_por_usuario, min_usuarios, max_usuarios, max_instancias_whatsapp, max_avaliacoes_ia_mes, storage_mb, permite_venda_modulo, ativo)
    VALUES ('Enterprise', 'enterprise', 'Plano completo com todos os módulos', 997, 9574, 249, 10, 9999, 9999, 999999, 102400, true, true)
    RETURNING id INTO enterprise_plan_id;
  ELSE
    UPDATE admin.planos SET preco_por_usuario = 249, min_usuarios = 10, permite_venda_modulo = true WHERE id = enterprise_plan_id;
  END IF;

  SELECT org INTO org_id FROM core.empresas WHERE dominio = 'gmail.com' LIMIT 1;

  IF org_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM admin.assinaturas WHERE org = org_id AND status = 'ativa') THEN
      INSERT INTO admin.assinaturas (org, plano_id, status, ciclo, inicio_em)
      VALUES (org_id, enterprise_plan_id, 'ativa', 'anual', now());
    ELSE
      UPDATE admin.assinaturas SET plano_id = enterprise_plan_id, status = 'ativa' WHERE org = org_id AND status = 'ativa';
    END IF;
  END IF;
END $$;

=====================================================
`);
