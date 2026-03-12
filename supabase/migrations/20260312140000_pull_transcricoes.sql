-- RPC to pull transcriptions from appmax.meet_conferences into saas.reunioes.
-- For meetings with status=TRANSCRIPT_DONE, copies transcript_text and transcript_copied_file_id.
-- Also updates status to 'concluida' when transcript is found.
-- Returns count of updated meetings.

CREATE OR REPLACE FUNCTION saas.pull_transcricoes(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas, appmax
AS $$
DECLARE
  v_updated int := 0;
  v_pending int := 0;
  v_total   int := 0;
  v_rec     record;
BEGIN
  -- Count total reunioes without transcription
  SELECT count(*) INTO v_total
  FROM saas.reunioes r
  WHERE r.empresa_id = p_empresa_id
    AND r.transcricao IS NULL
    AND r.google_event_id IS NOT NULL;

  -- For each reuniao without transcription, try to find it in meet_conferences
  FOR v_rec IN
    SELECT r.id AS reuniao_id, r.google_event_id
    FROM saas.reunioes r
    WHERE r.empresa_id = p_empresa_id
      AND r.transcricao IS NULL
      AND r.google_event_id IS NOT NULL
  LOOP
    DECLARE
      v_text text;
      v_file_id text;
      v_mc_status text;
    BEGIN
      -- Get best match from meet_conferences
      SELECT mc.transcript_text, mc.transcript_copied_file_id, mc.status
      INTO v_text, v_file_id, v_mc_status
      FROM appmax.meet_conferences mc
      WHERE mc.conference_key = v_rec.google_event_id
      ORDER BY (mc.transcript_text IS NOT NULL AND mc.transcript_text != '') DESC,
               mc.id DESC
      LIMIT 1;

      IF v_mc_status = 'TRANSCRIPT_DONE' THEN
        -- Has transcript - update reuniao
        UPDATE saas.reunioes
        SET transcricao = COALESCE(NULLIF(TRIM(v_text), ''), '[Transcrição no Drive: ' || v_file_id || ']'),
            transcript_file_id = v_file_id,
            status = 'concluida'
        WHERE id = v_rec.reuniao_id;
        v_updated := v_updated + 1;
      ELSIF v_mc_status = 'NEW' OR v_mc_status IS NULL THEN
        v_pending := v_pending + 1;
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'pending', v_pending,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION saas.pull_transcricoes(uuid) TO authenticated;
