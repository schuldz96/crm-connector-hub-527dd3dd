-- ============================================================================
-- Migration: Backlog Kanban Board for Super Admin
-- Date: 2026-04-10
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin.backlog_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  status text NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'analyzing', 'planning', 'developing', 'reviewing', 'testing', 'deploying', 'done')),
  prioridade text NOT NULL DEFAULT 'medium'
    CHECK (prioridade IN ('low', 'medium', 'high', 'urgent')),
  tipo text NOT NULL DEFAULT 'feature'
    CHECK (tipo IN ('feature', 'bug', 'improvement', 'refactor', 'docs')),
  agente_atual text,          -- which AIOX agent is working on it (e.g. 'dev', 'architect')
  agente_historico jsonb DEFAULT '[]'::jsonb,  -- [{agente, status, timestamp, nota}]
  tags text[] DEFAULT '{}',
  estimativa_horas numeric(6,1),
  modulo text,                -- which CRM module this relates to
  criado_por text DEFAULT 'super-admin',
  atualizado_em timestamptz DEFAULT now(),
  criado_em timestamptz DEFAULT now()
);

-- Index for status filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_backlog_status ON admin.backlog_tasks (status);
