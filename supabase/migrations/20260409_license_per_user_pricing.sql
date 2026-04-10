-- ============================================================================
-- Migration: Per-user pricing + module-level selling
-- Date: 2026-04-09
-- Description: Adds per-user pricing fields to plans, updates seed data,
--              and ensures plano_features covers all modules for license checks.
-- ============================================================================

-- 1. Add per-user pricing columns to admin.planos
ALTER TABLE admin.planos
  ADD COLUMN IF NOT EXISTS preco_por_usuario numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_usuarios int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS permite_venda_modulo boolean DEFAULT false;

-- 2. Update existing seed plans with new pricing
UPDATE admin.planos SET preco_por_usuario = 0,   min_usuarios = 1,  permite_venda_modulo = false WHERE codigo = 'free';
UPDATE admin.planos SET preco_por_usuario = 69,  min_usuarios = 2,  permite_venda_modulo = false WHERE codigo = 'starter';
UPDATE admin.planos SET preco_por_usuario = 149, min_usuarios = 5,  permite_venda_modulo = true  WHERE codigo = 'pro';
UPDATE admin.planos SET preco_por_usuario = 249, min_usuarios = 10, permite_venda_modulo = true  WHERE codigo = 'enterprise';

-- 3. Ensure all modules exist in core.modulos_sistema
INSERT INTO core.modulos_sistema (codigo, nome, descricao, ativo) VALUES
  ('dashboard',       'Dashboard',         'Painel principal com KPIs',                    true),
  ('meetings',        'Reuniões',          'Gestão de reuniões e transcrições',            true),
  ('whatsapp',        'WhatsApp',          'Integração WhatsApp via Evolution API',        true),
  ('inbox',           'Caixa de Entrada',  'Meta WhatsApp Business API',                   true),
  ('performance',     'Desempenho',        'Analytics de performance e avaliações',         true),
  ('training',        'Treinamentos',      'Treinamento IA com voz',                       true),
  ('crm',             'CRM',               'Contatos, Empresas, Negócios, Tickets',        true),
  ('teams',           'Times',             'Gestão de times e áreas',                       true),
  ('users',           'Usuários',          'Gestão de usuários',                            true),
  ('integrations',    'Integrações',       'HubSpot, APIs externas',                        true),
  ('automations',     'Automações',        'Webhooks e alertas',                             true),
  ('ai-config',       'Config. IA',        'Tokens e modelos OpenAI',                       true),
  ('reports',         'Relatórios',        'Relatórios e analytics',                         true),
  ('admin',           'Admin',             'Configurações da empresa',                       true),
  ('campaigns',       'Campanhas',         'Campanhas de marketing',                         true),
  ('email-marketing', 'E-mail Marketing',  'Disparo de e-mails',                             true),
  ('forms',           'Formulários',       'Captura de leads',                                true),
  ('health-score',    'Health Score',      'Saúde do cliente',                                true),
  ('onboarding',      'Onboarding',        'Ativação de clientes',                            true),
  ('nps-surveys',     'Pesquisas NPS',     'NPS e satisfação',                                true)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao;

-- 4. Seed plano_features for all plans × modules (if not exists)
-- This ensures every module has a feature entry per plan for license checking.
DO $$
DECLARE
  p record;
  m record;
  starter_modules text[] := ARRAY['dashboard','crm','whatsapp','inbox','meetings','performance','users','admin','integrations','automations'];
  pro_modules text[] := ARRAY['dashboard','crm','whatsapp','inbox','meetings','performance','users','admin','integrations','automations','ai-config','reports','training','teams','campaigns','email-marketing','forms','health-score','onboarding'];
  enterprise_modules text[] := ARRAY['dashboard','crm','whatsapp','inbox','meetings','performance','users','admin','integrations','automations','ai-config','reports','training','teams','campaigns','email-marketing','forms','health-score','onboarding','nps-surveys'];
  allowed_modules text[];
BEGIN
  FOR p IN SELECT id, codigo FROM admin.planos LOOP
    CASE p.codigo
      WHEN 'free' THEN allowed_modules := ARRAY['dashboard','crm','users'];
      WHEN 'starter' THEN allowed_modules := starter_modules;
      WHEN 'pro' THEN allowed_modules := pro_modules;
      WHEN 'enterprise' THEN allowed_modules := enterprise_modules;
      ELSE allowed_modules := ARRAY['dashboard'];
    END CASE;

    FOR m IN SELECT codigo, nome FROM core.modulos_sistema LOOP
      INSERT INTO admin.plano_features (plano_id, feature_codigo, feature_nome, habilitado, limite)
      VALUES (p.id, m.codigo, m.nome, m.codigo = ANY(allowed_modules), NULL)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
