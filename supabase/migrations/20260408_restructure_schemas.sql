-- ============================================================================
-- MIGRATION: Restructure schemas + add org column (multi-tenant SaaS key)
-- Date: 2026-04-08
-- Description: Move from 2 schemas (saas + public) to 7 schemas
--   admin, core, crm, ai, channels, audit, automation
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: Create new schemas
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS channels;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS automation;

-- ============================================================================
-- PHASE 2: Create org key generator function
-- ============================================================================
CREATE OR REPLACE FUNCTION core.generate_org_key() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result TEXT;
  i INT;
BEGIN
  LOOP
    result := substr(letters, floor(random()*26+1)::int, 1);
    FOR i IN 1..10 LOOP
      result := result || floor(random()*10)::int::text;
    END LOOP;
    result := result || substr(letters, floor(random()*26+1)::int, 1);
    -- Ensure uniqueness
    IF NOT EXISTS (SELECT 1 FROM core.empresas WHERE org = result) THEN
      RETURN result;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- PHASE 3: Move tables to new schemas
-- ============================================================================

-- ── CORE (organizational foundation) ────────────────────────────────────────
ALTER TABLE saas.empresas SET SCHEMA core;
ALTER TABLE saas.usuarios SET SCHEMA core;
ALTER TABLE saas.areas SET SCHEMA core;
ALTER TABLE saas.times SET SCHEMA core;
ALTER TABLE saas.solicitacoes_acesso SET SCHEMA core;
ALTER TABLE saas.permissoes_papeis SET SCHEMA core;
ALTER TABLE saas.modulos_sistema SET SCHEMA core;
ALTER TABLE saas.configuracoes_modulos_empresa SET SCHEMA core;
ALTER TABLE saas.configuracoes_modulos_usuario SET SCHEMA core;

-- ── CRM (move + rename: drop crm_ prefix) ──────────────────────────────────
ALTER TABLE saas.crm_contatos SET SCHEMA crm;
ALTER TABLE crm.crm_contatos RENAME TO contatos;

ALTER TABLE saas.crm_empresas SET SCHEMA crm;
ALTER TABLE crm.crm_empresas RENAME TO empresas_crm;

ALTER TABLE saas.crm_negocios SET SCHEMA crm;
ALTER TABLE crm.crm_negocios RENAME TO negocios;

ALTER TABLE saas.crm_tickets SET SCHEMA crm;
ALTER TABLE crm.crm_tickets RENAME TO tickets;

ALTER TABLE saas.crm_pipelines SET SCHEMA crm;
ALTER TABLE crm.crm_pipelines RENAME TO pipelines;

ALTER TABLE saas.crm_pipeline_estagios SET SCHEMA crm;
ALTER TABLE crm.crm_pipeline_estagios RENAME TO pipeline_estagios;

ALTER TABLE saas.crm_historico_estagios SET SCHEMA crm;
ALTER TABLE crm.crm_historico_estagios RENAME TO historico_estagios;

ALTER TABLE saas.crm_ticket_owner_history SET SCHEMA crm;
ALTER TABLE crm.crm_ticket_owner_history RENAME TO ticket_owner_history;

ALTER TABLE saas.crm_atividades SET SCHEMA crm;
ALTER TABLE crm.crm_atividades RENAME TO atividades;

ALTER TABLE saas.crm_associacoes SET SCHEMA crm;
ALTER TABLE crm.crm_associacoes RENAME TO associacoes;

ALTER TABLE saas.crm_notas SET SCHEMA crm;
ALTER TABLE crm.crm_notas RENAME TO notas;

ALTER TABLE saas.crm_ai_conversations SET SCHEMA crm;
ALTER TABLE crm.crm_ai_conversations RENAME TO ai_conversations;

ALTER TABLE saas.crm_estagio_ia_config SET SCHEMA crm;
ALTER TABLE crm.crm_estagio_ia_config RENAME TO estagio_ia_config;

-- ── AI (agents, analysis, evaluation) ───────────────────────────────────────
ALTER TABLE saas.agentes_ia SET SCHEMA ai;
ALTER TABLE ai.agentes_ia RENAME TO agentes;

ALTER TABLE saas.agente_arquivos SET SCHEMA ai;

ALTER TABLE saas.analises_ia SET SCHEMA ai;
ALTER TABLE ai.analises_ia RENAME TO analises;

ALTER TABLE saas.fila_avaliacoes SET SCHEMA ai;

ALTER TABLE saas.configuracoes_ia SET SCHEMA ai;
ALTER TABLE ai.configuracoes_ia RENAME TO configuracoes;

ALTER TABLE saas.tokens_ia_modulo SET SCHEMA ai;
ALTER TABLE ai.tokens_ia_modulo RENAME TO tokens_modulo;

-- ── CHANNELS: Meetings ──────────────────────────────────────────────────────
ALTER TABLE saas.reunioes SET SCHEMA channels;
ALTER TABLE saas.meet_conferences SET SCHEMA channels;
ALTER TABLE saas.avaliacoes_reunioes SET SCHEMA channels;
ALTER TABLE saas.comentarios_reuniao SET SCHEMA channels;

-- ── CHANNELS: WhatsApp Evolution ────────────────────────────────────────────
ALTER TABLE saas.instancias_whatsapp SET SCHEMA channels;
ALTER TABLE saas.conversas_whatsapp SET SCHEMA channels;
ALTER TABLE saas.mensagens_whatsapp SET SCHEMA channels;
ALTER TABLE saas.whatsapp_chat_settings SET SCHEMA channels;

-- ── CHANNELS: Meta Inbox (from public) ──────────────────────────────────────
ALTER TABLE public.meta_inbox_accounts SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_accounts RENAME TO meta_accounts;

ALTER TABLE public.meta_inbox_conversations SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_conversations RENAME TO meta_conversations;

ALTER TABLE public.meta_inbox_messages SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_messages RENAME TO meta_messages;

ALTER TABLE public.meta_inbox_templates SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_templates RENAME TO meta_templates;

ALTER TABLE public.meta_inbox_macros SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_macros RENAME TO meta_macros;

ALTER TABLE public.meta_inbox_tags SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_tags RENAME TO meta_tags;

ALTER TABLE public.meta_inbox_metrics_daily SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_metrics_daily RENAME TO meta_metrics_daily;

ALTER TABLE public.meta_bulk_send_logs SET SCHEMA channels;
ALTER TABLE channels.meta_bulk_send_logs RENAME TO meta_bulk_send_logs;

ALTER TABLE public.meta_inbox_user_access SET SCHEMA channels;
ALTER TABLE channels.meta_inbox_user_access RENAME TO meta_user_access;

-- ── AUDIT ───────────────────────────────────────────────────────────────────
ALTER TABLE saas.logs_auditoria SET SCHEMA audit;
ALTER TABLE audit.logs_auditoria RENAME TO logs;

ALTER TABLE saas.run_conference_api_logs SET SCHEMA audit;
ALTER TABLE audit.run_conference_api_logs RENAME TO api_logs;

ALTER TABLE saas.schema_migrations SET SCHEMA audit;

-- ── AUTOMATION ──────────────────────────────────────────────────────────────
ALTER TABLE saas.automacoes_webhooks SET SCHEMA automation;
ALTER TABLE automation.automacoes_webhooks RENAME TO webhooks;

ALTER TABLE saas.eventos_webhooks SET SCHEMA automation;
ALTER TABLE automation.eventos_webhooks RENAME TO webhook_eventos;

ALTER TABLE saas.integracoes SET SCHEMA automation;

ALTER TABLE saas.notificacoes SET SCHEMA automation;

-- ============================================================================
-- PHASE 4: Compatibility views in saas/public for existing functions/triggers
-- (Functions reference saas.tablename - views keep them working)
-- ============================================================================

-- Core tables
CREATE VIEW saas.empresas AS SELECT * FROM core.empresas;
CREATE VIEW saas.usuarios AS SELECT * FROM core.usuarios;
CREATE VIEW saas.areas AS SELECT * FROM core.areas;
CREATE VIEW saas.times AS SELECT * FROM core.times;
CREATE VIEW saas.solicitacoes_acesso AS SELECT * FROM core.solicitacoes_acesso;
CREATE VIEW saas.permissoes_papeis AS SELECT * FROM core.permissoes_papeis;
CREATE VIEW saas.modulos_sistema AS SELECT * FROM core.modulos_sistema;
CREATE VIEW saas.configuracoes_modulos_empresa AS SELECT * FROM core.configuracoes_modulos_empresa;
CREATE VIEW saas.configuracoes_modulos_usuario AS SELECT * FROM core.configuracoes_modulos_usuario;

-- CRM tables
CREATE VIEW saas.crm_contatos AS SELECT * FROM crm.contatos;
CREATE VIEW saas.crm_empresas AS SELECT * FROM crm.empresas_crm;
CREATE VIEW saas.crm_negocios AS SELECT * FROM crm.negocios;
CREATE VIEW saas.crm_tickets AS SELECT * FROM crm.tickets;
CREATE VIEW saas.crm_pipelines AS SELECT * FROM crm.pipelines;
CREATE VIEW saas.crm_pipeline_estagios AS SELECT * FROM crm.pipeline_estagios;
CREATE VIEW saas.crm_historico_estagios AS SELECT * FROM crm.historico_estagios;
CREATE VIEW saas.crm_ticket_owner_history AS SELECT * FROM crm.ticket_owner_history;
CREATE VIEW saas.crm_atividades AS SELECT * FROM crm.atividades;
CREATE VIEW saas.crm_associacoes AS SELECT * FROM crm.associacoes;
CREATE VIEW saas.crm_notas AS SELECT * FROM crm.notas;
CREATE VIEW saas.crm_ai_conversations AS SELECT * FROM crm.ai_conversations;
CREATE VIEW saas.crm_estagio_ia_config AS SELECT * FROM crm.estagio_ia_config;

-- AI tables
CREATE VIEW saas.agentes_ia AS SELECT * FROM ai.agentes;
CREATE VIEW saas.agente_arquivos AS SELECT * FROM ai.agente_arquivos;
CREATE VIEW saas.analises_ia AS SELECT * FROM ai.analises;
CREATE VIEW saas.fila_avaliacoes AS SELECT * FROM ai.fila_avaliacoes;
CREATE VIEW saas.configuracoes_ia AS SELECT * FROM ai.configuracoes;
CREATE VIEW saas.tokens_ia_modulo AS SELECT * FROM ai.tokens_modulo;

-- Channel tables (meetings + whatsapp)
CREATE VIEW saas.reunioes AS SELECT * FROM channels.reunioes;
CREATE VIEW saas.meet_conferences AS SELECT * FROM channels.meet_conferences;
CREATE VIEW saas.avaliacoes_reunioes AS SELECT * FROM channels.avaliacoes_reunioes;
CREATE VIEW saas.comentarios_reuniao AS SELECT * FROM channels.comentarios_reuniao;
CREATE VIEW saas.instancias_whatsapp AS SELECT * FROM channels.instancias_whatsapp;
CREATE VIEW saas.conversas_whatsapp AS SELECT * FROM channels.conversas_whatsapp;
CREATE VIEW saas.mensagens_whatsapp AS SELECT * FROM channels.mensagens_whatsapp;
CREATE VIEW saas.whatsapp_chat_settings AS SELECT * FROM channels.whatsapp_chat_settings;

-- Audit tables
CREATE VIEW saas.logs_auditoria AS SELECT * FROM audit.logs;
CREATE VIEW saas.run_conference_api_logs AS SELECT * FROM audit.api_logs;
CREATE VIEW saas.schema_migrations AS SELECT * FROM audit.schema_migrations;

-- Automation tables
CREATE VIEW saas.automacoes_webhooks AS SELECT * FROM automation.webhooks;
CREATE VIEW saas.eventos_webhooks AS SELECT * FROM automation.webhook_eventos;
CREATE VIEW saas.integracoes AS SELECT * FROM automation.integracoes;
CREATE VIEW saas.notificacoes AS SELECT * FROM automation.notificacoes;

-- Public meta inbox compatibility views
CREATE VIEW public.meta_inbox_accounts AS SELECT * FROM channels.meta_accounts;
CREATE VIEW public.meta_inbox_conversations AS SELECT * FROM channels.meta_conversations;
CREATE VIEW public.meta_inbox_messages AS SELECT * FROM channels.meta_messages;
CREATE VIEW public.meta_inbox_templates AS SELECT * FROM channels.meta_templates;
CREATE VIEW public.meta_inbox_macros AS SELECT * FROM channels.meta_macros;
CREATE VIEW public.meta_inbox_tags AS SELECT * FROM channels.meta_tags;
CREATE VIEW public.meta_inbox_metrics_daily AS SELECT * FROM channels.meta_metrics_daily;
CREATE VIEW public.meta_bulk_send_logs AS SELECT * FROM channels.meta_bulk_send_logs;
CREATE VIEW public.meta_inbox_user_access AS SELECT * FROM channels.meta_user_access;

-- ============================================================================
-- PHASE 5: Add org column to core.empresas and populate
-- ============================================================================

-- Add org to empresas (the master tenant key)
ALTER TABLE core.empresas ADD COLUMN IF NOT EXISTS org TEXT;

-- Populate existing empresas with org keys
DO $$
DECLARE
  r RECORD;
  letters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  new_org TEXT;
  i INT;
BEGIN
  FOR r IN SELECT id FROM core.empresas WHERE org IS NULL LOOP
    LOOP
      new_org := substr(letters, floor(random()*26+1)::int, 1);
      FOR i IN 1..10 LOOP
        new_org := new_org || floor(random()*10)::int::text;
      END LOOP;
      new_org := new_org || substr(letters, floor(random()*26+1)::int, 1);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM core.empresas WHERE org = new_org);
    END LOOP;
    UPDATE core.empresas SET org = new_org WHERE id = r.id;
  END LOOP;
END $$;

-- Make org NOT NULL + UNIQUE
ALTER TABLE core.empresas ALTER COLUMN org SET NOT NULL;
ALTER TABLE core.empresas ADD CONSTRAINT empresas_org_unique UNIQUE (org);
ALTER TABLE core.empresas ADD CONSTRAINT empresas_org_format
  CHECK (org ~ '^[A-Z][0-9]{10}[A-Z]$');

-- ============================================================================
-- PHASE 6: Add org column to ALL other tables and populate from empresa_id
-- ============================================================================

-- Helper function to add org to a table and populate from empresa_id
CREATE OR REPLACE FUNCTION core._add_org_column(p_schema TEXT, p_table TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  -- Add column if not exists
  EXECUTE format('ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS org TEXT', p_schema, p_table);

  -- Populate from empresa_id -> core.empresas.org
  EXECUTE format(
    'UPDATE %I.%I t SET org = e.org FROM core.empresas e WHERE e.id = t.empresa_id AND t.org IS NULL',
    p_schema, p_table
  );

  -- Create index
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_org ON %I.%I (org)', p_table, p_schema, p_table);
END $$;

-- ── Core tables ─────────────────────────────────────────────────────────────
SELECT core._add_org_column('core', 'usuarios');
SELECT core._add_org_column('core', 'areas');
SELECT core._add_org_column('core', 'times');
SELECT core._add_org_column('core', 'solicitacoes_acesso');
SELECT core._add_org_column('core', 'permissoes_papeis');
SELECT core._add_org_column('core', 'configuracoes_modulos_empresa');

-- ── CRM tables ──────────────────────────────────────────────────────────────
SELECT core._add_org_column('crm', 'contatos');
SELECT core._add_org_column('crm', 'empresas_crm');
SELECT core._add_org_column('crm', 'negocios');
SELECT core._add_org_column('crm', 'tickets');
SELECT core._add_org_column('crm', 'pipelines');
SELECT core._add_org_column('crm', 'pipeline_estagios');
SELECT core._add_org_column('crm', 'historico_estagios');
SELECT core._add_org_column('crm', 'ticket_owner_history');
SELECT core._add_org_column('crm', 'atividades');
SELECT core._add_org_column('crm', 'associacoes');
SELECT core._add_org_column('crm', 'notas');
SELECT core._add_org_column('crm', 'ai_conversations');
SELECT core._add_org_column('crm', 'estagio_ia_config');

-- ── AI tables ───────────────────────────────────────────────────────────────
SELECT core._add_org_column('ai', 'agentes');
SELECT core._add_org_column('ai', 'agente_arquivos');
SELECT core._add_org_column('ai', 'analises');
SELECT core._add_org_column('ai', 'fila_avaliacoes');
SELECT core._add_org_column('ai', 'configuracoes');
SELECT core._add_org_column('ai', 'tokens_modulo');

-- ── Channel tables ──────────────────────────────────────────────────────────
SELECT core._add_org_column('channels', 'reunioes');
SELECT core._add_org_column('channels', 'meet_conferences');
SELECT core._add_org_column('channels', 'avaliacoes_reunioes');
SELECT core._add_org_column('channels', 'comentarios_reuniao');
SELECT core._add_org_column('channels', 'instancias_whatsapp');
SELECT core._add_org_column('channels', 'conversas_whatsapp');
SELECT core._add_org_column('channels', 'mensagens_whatsapp');
SELECT core._add_org_column('channels', 'whatsapp_chat_settings');
SELECT core._add_org_column('channels', 'meta_accounts');
SELECT core._add_org_column('channels', 'meta_conversations');
SELECT core._add_org_column('channels', 'meta_messages');
SELECT core._add_org_column('channels', 'meta_templates');
SELECT core._add_org_column('channels', 'meta_macros');
SELECT core._add_org_column('channels', 'meta_tags');
SELECT core._add_org_column('channels', 'meta_metrics_daily');
SELECT core._add_org_column('channels', 'meta_bulk_send_logs');
SELECT core._add_org_column('channels', 'meta_user_access');

-- ── Audit tables ────────────────────────────────────────────────────────────
SELECT core._add_org_column('audit', 'logs');
SELECT core._add_org_column('audit', 'api_logs');

-- ── Automation tables ───────────────────────────────────────────────────────
SELECT core._add_org_column('automation', 'webhooks');
SELECT core._add_org_column('automation', 'webhook_eventos');
SELECT core._add_org_column('automation', 'integracoes');
SELECT core._add_org_column('automation', 'notificacoes');

-- Drop helper function
DROP FUNCTION core._add_org_column(TEXT, TEXT);

-- ============================================================================
-- PHASE 7: Create admin schema tables
-- ============================================================================

CREATE TABLE admin.planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  preco_mensal NUMERIC(10,2) DEFAULT 0,
  preco_anual NUMERIC(10,2) DEFAULT 0,
  max_usuarios INTEGER DEFAULT 5,
  max_instancias_whatsapp INTEGER DEFAULT 1,
  max_avaliacoes_ia_mes INTEGER DEFAULT 100,
  storage_mb INTEGER DEFAULT 500,
  ativo BOOLEAN DEFAULT true NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.plano_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plano_id UUID NOT NULL REFERENCES admin.planos(id) ON DELETE CASCADE,
  feature_codigo TEXT NOT NULL,
  feature_nome TEXT NOT NULL,
  habilitado BOOLEAN DEFAULT true NOT NULL,
  limite INTEGER,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.assinaturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org TEXT NOT NULL,
  plano_id UUID NOT NULL REFERENCES admin.planos(id),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'suspensa', 'trial', 'expirada')),
  ciclo TEXT NOT NULL DEFAULT 'mensal' CHECK (ciclo IN ('mensal', 'anual')),
  trial_ate TIMESTAMPTZ,
  inicio_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  proximo_pagamento TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.faturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assinatura_id UUID NOT NULL REFERENCES admin.assinaturas(id),
  org TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'vencida', 'cancelada')),
  referencia_mes TEXT NOT NULL,
  vencimento DATE NOT NULL,
  pago_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.uso_recursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org TEXT NOT NULL,
  mes_ref TEXT NOT NULL,
  usuarios_ativos INTEGER DEFAULT 0,
  instancias_whatsapp INTEGER DEFAULT 0,
  avaliacoes_ia INTEGER DEFAULT 0,
  storage_usado_mb INTEGER DEFAULT 0,
  mensagens_enviadas INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (org, mes_ref)
);

CREATE TABLE admin.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  habilitado_global BOOLEAN DEFAULT false NOT NULL,
  orgs_habilitadas TEXT[] DEFAULT '{}',
  planos_habilitados TEXT[] DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.super_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT,
  ativo BOOLEAN DEFAULT true NOT NULL,
  ultimo_login_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.config_plataforma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  tipo TEXT DEFAULT 'string' CHECK (tipo IN ('string', 'number', 'boolean', 'json')),
  descricao TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE admin.audit_admin (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admin.super_admins(id),
  acao TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  ip_origem TEXT,
  criado_em TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed default plans
INSERT INTO admin.planos (nome, codigo, descricao, preco_mensal, max_usuarios, max_instancias_whatsapp, max_avaliacoes_ia_mes, storage_mb)
VALUES
  ('Free', 'free', 'Plano gratuito para testar', 0, 2, 1, 10, 100),
  ('Starter', 'starter', 'Para pequenas equipes', 99, 5, 2, 100, 500),
  ('Pro', 'pro', 'Para equipes em crescimento', 299, 20, 5, 500, 2000),
  ('Enterprise', 'enterprise', 'Para grandes operacoes', 999, 100, 20, 5000, 10000);

-- ============================================================================
-- PHASE 8: Refresh compatibility views (now include org column)
-- ============================================================================
-- Views auto-reflect column changes since they use SELECT *
-- But we need to recreate them to pick up the new org column
CREATE OR REPLACE VIEW saas.empresas AS SELECT * FROM core.empresas;
CREATE OR REPLACE VIEW saas.usuarios AS SELECT * FROM core.usuarios;
CREATE OR REPLACE VIEW saas.reunioes AS SELECT * FROM channels.reunioes;
CREATE OR REPLACE VIEW saas.notificacoes AS SELECT * FROM automation.notificacoes;
CREATE OR REPLACE VIEW saas.fila_avaliacoes AS SELECT * FROM ai.fila_avaliacoes;
CREATE OR REPLACE VIEW saas.meet_conferences AS SELECT * FROM channels.meet_conferences;
CREATE OR REPLACE VIEW saas.tokens_ia_modulo AS SELECT * FROM ai.tokens_modulo;
CREATE OR REPLACE VIEW saas.crm_historico_estagios AS SELECT * FROM crm.historico_estagios;
CREATE OR REPLACE VIEW saas.times AS SELECT * FROM core.times;

COMMIT;
