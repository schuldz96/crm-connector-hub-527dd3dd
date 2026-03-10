-- Add columns for Google Meet transcript sync
-- google_event_id: unique identifier from Google Calendar to avoid duplicate syncs
-- participantes: JSON array of participant objects [{email, name}]
-- transcricao: full transcript text from Google Drive

ALTER TABLE saas.reunioes
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS participantes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transcricao text;

-- Unique constraint to prevent duplicate imports per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_reunioes_google_event
  ON saas.reunioes (empresa_id, google_event_id)
  WHERE google_event_id IS NOT NULL;
