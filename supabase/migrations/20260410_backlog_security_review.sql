-- ============================================================================
-- Migration: Add security-review status + imagem_url to backlog_tasks
-- Date: 2026-04-10
-- ============================================================================

-- Drop the old status check constraint and recreate with security-review
ALTER TABLE admin.backlog_tasks DROP CONSTRAINT IF EXISTS backlog_tasks_status_check;
ALTER TABLE admin.backlog_tasks ADD CONSTRAINT backlog_tasks_status_check
  CHECK (status IN ('backlog', 'analyzing', 'planning', 'developing', 'reviewing', 'testing', 'security-review', 'deploying', 'done'));

-- Add imagem_url column if it doesn't exist (was added via direct ALTER previously)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'admin' AND table_name = 'backlog_tasks' AND column_name = 'imagem_url'
  ) THEN
    ALTER TABLE admin.backlog_tasks ADD COLUMN imagem_url text;
  END IF;
END $$;
