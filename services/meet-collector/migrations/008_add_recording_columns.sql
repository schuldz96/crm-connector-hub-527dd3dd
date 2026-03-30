-- Add recording metadata support to conference ingestion
ALTER TABLE saas.meet_conferences
  ADD COLUMN IF NOT EXISTS recording_source_file_id text,
  ADD COLUMN IF NOT EXISTS recording_copied_file_id text,
  ADD COLUMN IF NOT EXISTS recording_name text,
  ADD COLUMN IF NOT EXISTS recording_mime_type text,
  ADD COLUMN IF NOT EXISTS recording_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS recording_web_view_link text,
  ADD COLUMN IF NOT EXISTS recording_web_content_link text;

CREATE INDEX IF NOT EXISTS idx_saas_meet_conferences_recording_source
  ON saas.meet_conferences(recording_source_file_id);
