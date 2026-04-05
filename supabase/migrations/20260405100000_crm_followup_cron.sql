-- Cron job que processa follow-ups de IA do CRM a cada 30 segundos.
-- Chama a Edge Function crm-ai-followup via pg_net.

SELECT cron.unschedule('crm-ai-followup-worker')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-ai-followup-worker');

SELECT cron.schedule(
  'crm-ai-followup-worker',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/crm-ai-followup',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
