-- Enable pg_net extension (already available in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- RPC to fire POST requests for all NEW conferences via pg_net (server-side, no CORS).
-- Each conference_key is sent to the webhook, which processes the transcription.
CREATE OR REPLACE FUNCTION saas.disparar_transcricoes(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = saas, appmax, extensions
AS $$
DECLARE
  v_rec record;
  v_dispatched int := 0;
  v_skipped int := 0;
  v_keys text[] := '{}';
BEGIN
  FOR v_rec IN
    SELECT mc.conference_key
    FROM appmax.meet_conferences mc
    WHERE mc.call_interna = false
      AND (mc.transcript_copied_file_id IS NULL OR mc.transcript_copied_file_id = '')
      AND mc.conference_key IS NOT NULL
  LOOP
    -- Fire POST via pg_net (async, server-side)
    PERFORM net.http_post(
      url := 'https://apiouvidoria.contato-lojavirtual.com/webhook/transcricoes_meet',
      headers := '{"Content-Type": "application/json", "x-webhook-token": "api-meet-comercial"}'::jsonb,
      body := jsonb_build_object('conference_key', v_rec.conference_key)
    );
    v_dispatched := v_dispatched + 1;
    v_keys := array_append(v_keys, v_rec.conference_key);
  END LOOP;

  -- Count skipped (already have transcript)
  SELECT count(*) INTO v_skipped
  FROM appmax.meet_conferences mc
  WHERE mc.call_interna = false
    AND mc.transcript_copied_file_id IS NOT NULL
    AND mc.transcript_copied_file_id != '';

  RETURN jsonb_build_object(
    'dispatched', v_dispatched,
    'skipped', v_skipped,
    'keys', to_jsonb(v_keys)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION saas.disparar_transcricoes(uuid) TO authenticated;
