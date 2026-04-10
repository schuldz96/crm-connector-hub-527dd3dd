-- Add reactions support to meta_inbox_messages
-- Reactions are stored as JSONB array on the target message instead of separate rows
-- Format: [{"emoji": "👍", "from": "5511999...", "ts": "2026-..."}]
ALTER TABLE public.meta_inbox_messages
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT NULL;
