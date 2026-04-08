-- Mudar avaliação automática de 1x/dia para 1x/hora
-- Unschedule o antigo e criar novo

SELECT cron.unschedule('avaliar-desempenho-diario');

SELECT cron.schedule(
  'avaliar-desempenho-horario',
  '0 * * * *',  -- A cada hora, minuto 0
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/evaluate-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
