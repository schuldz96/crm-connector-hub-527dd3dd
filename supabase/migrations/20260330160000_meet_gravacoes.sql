-- ============================================================
-- Meet: suporte a gravacao automatica
-- - Colunas em saas.meet_conferences para metadata da gravacao
-- - Espelhamento em saas.reunioes para consumo no SaaS
-- - RPC buscar_transcript_file passa a retornar campos de gravacao
-- ============================================================

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

ALTER TABLE saas.reunioes
  ADD COLUMN IF NOT EXISTS gravacao_file_id text,
  ADD COLUMN IF NOT EXISTS gravacao_nome text,
  ADD COLUMN IF NOT EXISTS gravacao_link text;

COMMENT ON COLUMN saas.reunioes.gravacao_file_id IS 'Google Drive file ID da gravacao (preferencialmente arquivo copiado para pasta central).';
COMMENT ON COLUMN saas.reunioes.gravacao_nome IS 'Nome do arquivo de gravacao no Google Drive.';
COMMENT ON COLUMN saas.reunioes.gravacao_link IS 'Link web para visualizacao/download da gravacao.';

CREATE OR REPLACE FUNCTION saas.trg_sync_gravacao_reuniao_from_meet_conference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas
AS $$
BEGIN
  UPDATE saas.reunioes r
  SET
    gravacao_file_id = COALESCE(new.recording_copied_file_id, new.recording_source_file_id, r.gravacao_file_id),
    gravacao_nome = COALESCE(new.recording_name, r.gravacao_nome),
    gravacao_link = COALESCE(new.recording_web_view_link, new.recording_web_content_link, r.gravacao_link),
    atualizado_em = now()
  WHERE r.google_event_id = new.conference_key;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gravacao_reuniao_from_meet_conference ON saas.meet_conferences;
CREATE TRIGGER trg_sync_gravacao_reuniao_from_meet_conference
AFTER INSERT OR UPDATE ON saas.meet_conferences
FOR EACH ROW
EXECUTE FUNCTION saas.trg_sync_gravacao_reuniao_from_meet_conference();

-- Backfill inicial para reuniões já existentes
UPDATE saas.reunioes r
SET
  gravacao_file_id = COALESCE(mc.recording_copied_file_id, mc.recording_source_file_id, r.gravacao_file_id),
  gravacao_nome = COALESCE(mc.recording_name, r.gravacao_nome),
  gravacao_link = COALESCE(mc.recording_web_view_link, mc.recording_web_content_link, r.gravacao_link),
  atualizado_em = now()
FROM saas.meet_conferences mc
WHERE r.google_event_id = mc.conference_key;

CREATE OR REPLACE FUNCTION saas.buscar_transcript_file(p_conference_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'transcript_source_file_id', mc.transcript_source_file_id,
    'transcript_copied_file_id', mc.transcript_copied_file_id,
    'transcript_text', mc.transcript_text,
    'meeting_code', mc.meeting_code,
    'status', mc.status,
    'recording_source_file_id', mc.recording_source_file_id,
    'recording_copied_file_id', mc.recording_copied_file_id,
    'recording_name', mc.recording_name,
    'recording_mime_type', mc.recording_mime_type,
    'recording_size_bytes', mc.recording_size_bytes,
    'recording_web_view_link', mc.recording_web_view_link,
    'recording_web_content_link', mc.recording_web_content_link
  )
  INTO v_result
  FROM saas.meet_conferences mc
  WHERE mc.conference_key = p_conference_key
  LIMIT 1;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION saas.buscar_transcript_file(text) TO authenticated;
