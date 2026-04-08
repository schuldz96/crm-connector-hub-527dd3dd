--
-- PostgreSQL database dump
--

\restrict 1Dd1Nq0HAMJaP3ofJPwLUDGQD2cryHNVUy6GzB8lUujhh3qTrpEYCVkHvo7QmhT

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: saas; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA saas;


--
-- Name: SCHEMA saas; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA saas IS 'Schema principal do Appmax SaaS';


--
-- Name: escopo_permissao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.escopo_permissao AS ENUM (
    'todos',
    'area',
    'time',
    'proprio'
);


--
-- Name: fonte_contato; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.fonte_contato AS ENUM (
    'website',
    'linkedin',
    'referencia',
    'campanha',
    'whatsapp',
    'email',
    'telefone',
    'evento',
    'importacao',
    'outros'
);


--
-- Name: papel_usuario; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.papel_usuario AS ENUM (
    'admin',
    'ceo',
    'diretor',
    'gerente',
    'coordenador',
    'supervisor',
    'vendedor',
    'suporte',
    'bdr',
    'sdr',
    'closer',
    'key_account',
    'csm',
    'low_touch'
);


--
-- Name: prioridade_ticket; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.prioridade_ticket AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: status_contato; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_contato AS ENUM (
    'lead',
    'qualified',
    'customer',
    'churned'
);


--
-- Name: status_instancia_whatsapp; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_instancia_whatsapp AS ENUM (
    'conectada',
    'desconectada',
    'conectando'
);


--
-- Name: status_integracao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_integracao AS ENUM (
    'conectada',
    'desconectada',
    'erro'
);


--
-- Name: status_negocio; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_negocio AS ENUM (
    'aberto',
    'ganho',
    'perdido'
);


--
-- Name: status_notificacao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_notificacao AS ENUM (
    'nao_lida',
    'lida',
    'arquivada'
);


--
-- Name: status_reuniao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_reuniao AS ENUM (
    'agendada',
    'concluida',
    'cancelada',
    'no_show'
);


--
-- Name: status_solicitacao_acesso; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_solicitacao_acesso AS ENUM (
    'pendente',
    'aprovada',
    'rejeitada'
);


--
-- Name: status_tarefa; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_tarefa AS ENUM (
    'pendente',
    'em_andamento',
    'concluida',
    'cancelada'
);


--
-- Name: status_ticket; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_ticket AS ENUM (
    'aberto',
    'em_andamento',
    'aguardando',
    'resolvido',
    'fechado'
);


--
-- Name: status_usuario; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.status_usuario AS ENUM (
    'ativo',
    'inativo'
);


--
-- Name: tipo_atividade_crm; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.tipo_atividade_crm AS ENUM (
    'nota',
    'email',
    'chamada',
    'tarefa',
    'reuniao',
    'whatsapp',
    'sms',
    'linkedin'
);


--
-- Name: tipo_integracao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.tipo_integracao AS ENUM (
    'google_calendar',
    'google_meet',
    'hubspot',
    'openai',
    'evolution_api',
    'n8n'
);


--
-- Name: tipo_notificacao; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.tipo_notificacao AS ENUM (
    'reuniao',
    'whatsapp',
    'sistema',
    'performance'
);


--
-- Name: tipo_plano; Type: TYPE; Schema: saas; Owner: -
--

CREATE TYPE saas.tipo_plano AS ENUM (
    'starter',
    'pro',
    'enterprise'
);


--
-- Name: inbox_conversation_opened_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inbox_conversation_opened_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM public.update_inbox_metric(NEW.account_id, NEW.empresa_id, (NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'conversations_opened');
  PERFORM public.update_inbox_metric(NEW.account_id, NEW.empresa_id, (NEW.created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'unique_contacts');
  RETURN NEW;
END;
$$;


--
-- Name: inbox_message_metrics_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inbox_message_metrics_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_conv_id uuid;
  v_account_id uuid;
  v_empresa_id uuid;
  v_first_inbound timestamptz;
BEGIN
  v_conv_id := NEW.conversation_id;
  v_account_id := NEW.account_id;
  v_empresa_id := NEW.empresa_id;

  IF NEW.from_me THEN
    -- Outbound message
    UPDATE public.meta_inbox_conversations
    SET total_messages_out = COALESCE(total_messages_out, 0) + 1,
        participants_out = CASE
          WHEN NOT (participants_out @> ARRAY[NEW.from_phone])
          THEN array_append(COALESCE(participants_out, '{}'), NEW.from_phone)
          ELSE participants_out END
    WHERE id = v_conv_id;

    -- Track first response time (first outbound after first inbound)
    UPDATE public.meta_inbox_conversations
    SET first_response_at = NEW.timestamp,
        first_response_ms = EXTRACT(EPOCH FROM (NEW.timestamp - last_inbound_ts)) * 1000
    WHERE id = v_conv_id
      AND first_response_at IS NULL
      AND last_inbound_ts IS NOT NULL;

    -- Daily metric
    PERFORM public.update_inbox_metric(v_account_id, v_empresa_id, (NEW.timestamp AT TIME ZONE 'America/Sao_Paulo')::date, 'messages_out');

    -- Track media/template sends
    IF NEW.msg_type IN ('image', 'video', 'audio', 'document') THEN
      PERFORM public.update_inbox_metric(v_account_id, v_empresa_id, (NEW.timestamp AT TIME ZONE 'America/Sao_Paulo')::date, 'media_sent');
    END IF;
    IF NEW.msg_type = 'template' THEN
      PERFORM public.update_inbox_metric(v_account_id, v_empresa_id, (NEW.timestamp AT TIME ZONE 'America/Sao_Paulo')::date, 'templates_sent');
    END IF;
  ELSE
    -- Inbound message
    UPDATE public.meta_inbox_conversations
    SET total_messages_in = COALESCE(total_messages_in, 0) + 1
    WHERE id = v_conv_id;

    -- Daily metric
    PERFORM public.update_inbox_metric(v_account_id, v_empresa_id, (NEW.timestamp AT TIME ZONE 'America/Sao_Paulo')::date, 'messages_in');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_meet_conferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_meet_conferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_inbox_metric(uuid, uuid, date, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_inbox_metric(p_account_id uuid, p_empresa_id uuid, p_date date, p_field text, p_increment integer DEFAULT 1) RETURNS void
    LANGUAGE plpgsql
    AS $_$
BEGIN
  INSERT INTO public.meta_inbox_metrics_daily (account_id, empresa_id, date)
  VALUES (p_account_id, p_empresa_id, p_date)
  ON CONFLICT (account_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.meta_inbox_metrics_daily SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE account_id = $2 AND date = $3',
    p_field, p_field
  )
  USING p_increment, p_account_id, p_date;
END;
$_$;


--
-- Name: update_meta_inbox_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_meta_inbox_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: alertar_reuniao_sem_transcricao(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.alertar_reuniao_sem_transcricao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_vendedor_id UUID;
  v_supervisor_id UUID;
  v_titulo TEXT;
BEGIN
  -- Only trigger when status changes to 'concluida' and transcricao is null/empty
  IF NEW.status = 'concluida' 
     AND (NEW.transcricao IS NULL OR LENGTH(TRIM(NEW.transcricao)) < 10)
     AND (OLD.status IS NULL OR OLD.status != 'concluida')
  THEN
    v_vendedor_id := NEW.vendedor_id;
    v_titulo := COALESCE(NEW.titulo, 'Reunião sem título');
    
    -- Alert the owner (vendedor)
    IF v_vendedor_id IS NOT NULL THEN
      INSERT INTO saas.notificacoes (empresa_id, usuario_id, tipo, titulo, descricao, link, status)
      VALUES (
        NEW.empresa_id,
        v_vendedor_id,
        'reuniao',
        'Reunião sem transcrição',
        'A reunião "' || v_titulo || '" foi concluída mas não possui transcrição. Verifique se a gravação do Google Meet está habilitada.',
        '/meetings',
        'nao_lida'
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Find and alert the supervisor of the owner's team
    IF v_vendedor_id IS NOT NULL THEN
      SELECT t.supervisor_id INTO v_supervisor_id
      FROM saas.usuarios u
      JOIN saas.times t ON t.id = u.time_id
      WHERE u.id = v_vendedor_id
      LIMIT 1;

      IF v_supervisor_id IS NOT NULL AND v_supervisor_id != v_vendedor_id THEN
        INSERT INTO saas.notificacoes (empresa_id, usuario_id, tipo, titulo, descricao, link, status)
        VALUES (
          NEW.empresa_id,
          v_supervisor_id,
          'reuniao',
          'Reunião sem transcrição',
          'A reunião "' || v_titulo || '" do vendedor foi concluída sem transcrição.',
          '/meetings',
          'nao_lida'
        ) ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: buscar_transcript_file(text); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.buscar_transcript_file(p_conference_key text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
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


--
-- Name: definir_atualizado_em(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.definir_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;


--
-- Name: definir_numero_registro(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.definir_numero_registro() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
declare
  novo_numero text;
  tentativas integer := 0;
  existe boolean;
begin
  -- So gera se nao foi informado manualmente
  if new.numero_registro is null or new.numero_registro = '' then
    loop
      novo_numero := saas.gerar_numero_registro();
      -- Verificar unicidade na propria tabela
      execute format(
        'SELECT EXISTS(SELECT 1 FROM %I.%I WHERE numero_registro = $1)',
        tg_table_schema, tg_table_name
      ) into existe using novo_numero;

      exit when not existe;
      tentativas := tentativas + 1;
      if tentativas > 100 then
        raise exception 'Falha ao gerar numero_registro unico apos 100 tentativas';
      end if;
    end loop;
    new.numero_registro := novo_numero;
  end if;
  return new;
end;
$_$;


--
-- Name: disparar_transcricoes(uuid); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.disparar_transcricoes(p_empresa_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas', 'extensions'
    AS $$
declare
  v_rec record;
  v_dispatched int := 0;
  v_skipped int := 0;
  v_keys text[] := '{}';
begin
  for v_rec in
    select mc.conference_key
    from saas.meet_conferences mc
    where coalesce(mc.call_interna, false) = false
      and (mc.transcript_copied_file_id is null or mc.transcript_copied_file_id = '')
      and mc.conference_key is not null
      and (mc.empresa_id = p_empresa_id or p_empresa_id is null)
  loop
    perform net.http_post(
      url := 'https://apiouvidoria.contato-lojavirtual.com/webhook/transcricoes_meet',
      headers := '{"Content-Type": "application/json", "x-webhook-token": "api-meet-comercial"}'::jsonb,
      body := jsonb_build_object('conference_key', v_rec.conference_key)
    );
    v_dispatched := v_dispatched + 1;
    v_keys := array_append(v_keys, v_rec.conference_key);
  end loop;

  select count(*) into v_skipped
  from saas.meet_conferences mc
  where coalesce(mc.call_interna, false) = false
    and mc.transcript_copied_file_id is not null
    and mc.transcript_copied_file_id != ''
    and (mc.empresa_id = p_empresa_id or p_empresa_id is null);

  return jsonb_build_object(
    'dispatched', v_dispatched,
    'skipped', v_skipped,
    'keys', to_jsonb(v_keys)
  );
end;
$$;


--
-- Name: enfileirar_avaliacao(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.enfileirar_avaliacao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Only enqueue if:
  -- 1. transcricao was NULL and now has content, OR
  -- 2. transcricao changed (re-transcription)
  IF (NEW.transcricao IS NOT NULL AND LENGTH(NEW.transcricao) > 50)
     AND (OLD.transcricao IS NULL OR OLD.transcricao != NEW.transcricao)
     AND NEW.status = 'concluida'
  THEN
    -- Insert into queue (ignore if already pending)
    INSERT INTO saas.fila_avaliacoes (empresa_id, reuniao_id, status)
    VALUES (NEW.empresa_id, NEW.id, 'pendente')
    ON CONFLICT (reuniao_id, status) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: enfileirar_avaliacao_reuniao(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.enfileirar_avaliacao_reuniao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only enqueue if transcription was just added (was null, now has value)
  IF (OLD.transcricao IS NULL OR OLD.transcricao = '') AND NEW.transcricao IS NOT NULL AND length(NEW.transcricao) > 50 THEN
    INSERT INTO saas.fila_avaliacoes (empresa_id, reuniao_id, status)
    VALUES (NEW.empresa_id, NEW.id, 'pendente')
    ON CONFLICT (reuniao_id, status) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: gerar_nome_interno(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.gerar_nome_interno() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.nome_interno := floor(random() * 900000000 + 100000000)::bigint;
  RETURN NEW;
END;
$$;


--
-- Name: gerar_numero_registro(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.gerar_numero_registro() RETURNS text
    LANGUAGE plpgsql
    AS $$
declare
  letras text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  digitos text := '';
  i integer;
begin
  -- Primeira letra aleatoria
  digitos := substr(letras, floor(random() * 26 + 1)::int, 1);
  -- 10 digitos aleatorios
  for i in 1..10 loop
    digitos := digitos || floor(random() * 10)::int::text;
  end loop;
  -- Ultima letra aleatoria
  digitos := digitos || substr(letras, floor(random() * 26 + 1)::int, 1);
  return digitos;
end;
$$;


--
-- Name: openai_chat(text, text, jsonb, numeric, integer); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.openai_chat(p_token text, p_model text DEFAULT 'gpt-4o-mini'::text, p_messages jsonb DEFAULT '[]'::jsonb, p_temperature numeric DEFAULT 0.3, p_max_tokens integer DEFAULT 1500) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  response extensions.http_response;
  body jsonb;
BEGIN
  body := jsonb_build_object(
    'model', p_model,
    'messages', p_messages,
    'temperature', p_temperature,
    'max_tokens', p_max_tokens
  );

  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.openai.com/v1/chat/completions',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || p_token),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    body::text
  )::extensions.http_request);

  IF response.status != 200 THEN
    RETURN jsonb_build_object('error', 'OpenAI HTTP ' || response.status, 'body', response.content::jsonb);
  END IF;

  RETURN response.content::jsonb;
END;
$$;


--
-- Name: pull_transcricoes(uuid); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.pull_transcricoes(p_empresa_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
    AS $$
declare
  v_updated int := 0;
  v_pending int := 0;
  v_total int := 0;
  v_rec record;
  v_text text;
  v_file_id text;
  v_mc_status text;
begin
  select count(*) into v_total
  from saas.reunioes r
  where r.empresa_id = p_empresa_id
    and (r.transcricao is null or r.transcricao like '[Transcrição no Drive:%')
    and r.google_event_id is not null;

  for v_rec in
    select r.id as reuniao_id, r.google_event_id
    from saas.reunioes r
    where r.empresa_id = p_empresa_id
      and (r.transcricao is null or r.transcricao like '[Transcrição no Drive:%')
      and r.google_event_id is not null
  loop
    select mc.transcript_text, mc.transcript_copied_file_id, mc.status
    into v_text, v_file_id, v_mc_status
    from saas.meet_conferences mc
    where mc.conference_key = v_rec.google_event_id
    order by (mc.transcript_text is not null and mc.transcript_text != '') desc,
             mc.id desc
    limit 1;

    if v_mc_status = 'TRANSCRIPT_DONE' then
      update saas.reunioes
      set transcricao = coalesce(nullif(trim(v_text), ''), transcricao),
          transcript_file_id = coalesce(v_file_id, transcript_file_id),
          status = 'concluida'
      where id = v_rec.reuniao_id;
      v_updated := v_updated + 1;
    elsif v_mc_status = 'NEW' or v_mc_status is null then
      v_pending := v_pending + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'updated', v_updated,
    'pending', v_pending,
    'total', v_total
  );
end;
$$;


--
-- Name: registrar_historico_estagio_insert_negocio(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.registrar_historico_estagio_insert_negocio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.estagio_id IS NOT NULL THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'deal', NEW.id, NULL, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: registrar_historico_estagio_insert_ticket(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.registrar_historico_estagio_insert_ticket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.estagio_id IS NOT NULL THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'ticket', NEW.id, NULL, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: registrar_historico_estagio_negocio(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.registrar_historico_estagio_negocio() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.estagio_id IS DISTINCT FROM NEW.estagio_id THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'deal', NEW.id, OLD.estagio_id, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: registrar_historico_estagio_ticket(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.registrar_historico_estagio_ticket() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.estagio_id IS DISTINCT FROM NEW.estagio_id THEN
    INSERT INTO saas.crm_historico_estagios (empresa_id, entidade_tipo, entidade_id, estagio_anterior_id, estagio_novo_id)
    VALUES (NEW.empresa_id, 'ticket', NEW.id, OLD.estagio_id, NEW.estagio_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: sincronizar_reuniao_meet(text, uuid); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.sincronizar_reuniao_meet(p_conference_key text, p_empresa_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
    AS $$
declare
  v_rec record;
  v_empresa_id uuid;
  v_vendedor_id uuid;
  v_duracao int;
  v_participantes jsonb;
  v_titulo text;
  v_cliente_email text;
  v_cliente_nome text;
  v_status saas.status_reuniao;
  v_reuniao_id uuid;
begin
  select * into v_rec
  from saas.meet_conferences
  where conference_key = p_conference_key
  limit 1;

  if v_rec is null then
    return null;
  end if;

  v_empresa_id := coalesce(p_empresa_id, v_rec.empresa_id);

  if v_empresa_id is null then
    select e.id into v_empresa_id
    from saas.empresas e
    where v_rec.organizer_email is not null
      and lower(split_part(v_rec.organizer_email, '@', 2)) = lower(e.dominio::text)
    limit 1;
  end if;

  if v_empresa_id is null then
    return null;
  end if;

  if coalesce(v_rec.call_interna, false) = true then
    return null;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_rec.participants, '[]'::jsonb)) p
    where coalesce(p->>'email', p #>> '{}') not like '%@appmax.com.br'
  ) then
    return null;
  end if;

  select u.id into v_vendedor_id
  from saas.usuarios u
  where u.empresa_id = v_empresa_id
    and lower(u.email::text) = lower(v_rec.organizer_email)
  limit 1;

  v_duracao := coalesce(extract(epoch from (v_rec.ended_at - v_rec.started_at))::int / 60, 0);

  v_titulo := coalesce(
    nullif(trim(v_rec.title), ''),
    'Reunião ' || to_char(v_rec.started_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
  );

  if v_rec.participants is not null and jsonb_typeof(v_rec.participants) = 'array' then
    select jsonb_agg(
      case
        when jsonb_typeof(elem) = 'string' then jsonb_build_object('email', elem #>> '{}')
        when elem ? 'email' then elem
        else jsonb_build_object('email', elem::text)
      end
    )
    into v_participantes
    from jsonb_array_elements(v_rec.participants) elem;
  else
    v_participantes := '[]'::jsonb;
  end if;

  select p->>'email' into v_cliente_email
  from jsonb_array_elements(v_participantes) p
  where (p->>'email') not like '%@appmax.com.br'
  limit 1;

  v_cliente_nome := coalesce(
    (select p->>'name' from jsonb_array_elements(v_participantes) p where p->>'email' = v_cliente_email limit 1),
    split_part(coalesce(v_cliente_email, ''), '@', 1)
  );

  v_status := case when v_rec.ended_at is null then 'agendada'::saas.status_reuniao else 'concluida'::saas.status_reuniao end;

  insert into saas.reunioes (
    empresa_id, vendedor_id, titulo, data_reuniao, duracao_minutos,
    cliente_nome, cliente_email, link_meet, status,
    google_event_id, participantes, transcricao, transcript_file_id
  ) values (
    v_empresa_id, v_vendedor_id, v_titulo, v_rec.started_at, v_duracao,
    v_cliente_nome, v_cliente_email,
    case when v_rec.meeting_code is not null then 'https://meet.google.com/' || v_rec.meeting_code else null end,
    v_status,
    v_rec.conference_key, v_participantes,
    case when coalesce(trim(v_rec.transcript_text), '') <> '' then v_rec.transcript_text else null end,
    v_rec.transcript_copied_file_id
  )
  on conflict (empresa_id, google_event_id)
  do update set
    vendedor_id = excluded.vendedor_id,
    duracao_minutos = excluded.duracao_minutos,
    participantes = excluded.participantes,
    status = excluded.status,
    cliente_nome = coalesce(saas.reunioes.cliente_nome, excluded.cliente_nome),
    cliente_email = coalesce(saas.reunioes.cliente_email, excluded.cliente_email),
    transcricao = coalesce(nullif(trim(excluded.transcricao), ''), saas.reunioes.transcricao),
    transcript_file_id = coalesce(excluded.transcript_file_id, saas.reunioes.transcript_file_id),
    atualizado_em = now()
  returning id into v_reuniao_id;

  return v_reuniao_id;
end;
$$;


--
-- Name: sincronizar_reunioes(uuid); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.sincronizar_reunioes(p_empresa_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
    AS $$
declare
  v_inserted int := 0;
  v_updated int := 0;
  v_before_count int;
  v_after_count int;
  v_rec record;
begin
  select count(*) into v_before_count from saas.reunioes where empresa_id = p_empresa_id;

  for v_rec in
    select conference_key
    from saas.meet_conferences
    where coalesce(call_interna, false) = false
      and (
        empresa_id = p_empresa_id
        or (
          empresa_id is null
          and exists (
            select 1
            from saas.empresas e
            where e.id = p_empresa_id
              and organizer_email is not null
              and lower(split_part(organizer_email, '@', 2)) = lower(e.dominio::text)
          )
        )
      )
  loop
    perform saas.sincronizar_reuniao_meet(v_rec.conference_key, p_empresa_id);
  end loop;

  select count(*) into v_after_count from saas.reunioes where empresa_id = p_empresa_id;
  v_inserted := greatest(v_after_count - v_before_count, 0);

  return jsonb_build_object('inserted', v_inserted, 'updated', v_after_count - v_inserted);
end;
$$;


--
-- Name: trg_sync_gravacao_reuniao_from_meet_conference(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.trg_sync_gravacao_reuniao_from_meet_conference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
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


--
-- Name: trg_sync_reuniao_from_meet_conference(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.trg_sync_reuniao_from_meet_conference() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'saas'
    AS $$
begin
  perform saas.sincronizar_reuniao_meet(new.conference_key, new.empresa_id);
  return new;
end;
$$;


--
-- Name: validate_openai_token(); Type: FUNCTION; Schema: saas; Owner: -
--

CREATE FUNCTION saas.validate_openai_token() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Only validate OpenAI tokens
  IF NEW.provedor = 'openai' THEN
    -- Allow enc: (legacy encrypted) or sk- (valid OpenAI) or NULL
    IF NEW.token_criptografado IS NOT NULL 
       AND NEW.token_criptografado != ''
       AND NOT NEW.token_criptografado LIKE 'sk-%' 
       AND NOT NEW.token_criptografado LIKE 'enc:%' THEN
      -- Preserve the old value instead of allowing corruption
      IF TG_OP = 'UPDATE' THEN
        NEW.token_criptografado := OLD.token_criptografado;
      ELSE
        NEW.token_criptografado := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: meta_bulk_send_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_bulk_send_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    empresa_id uuid NOT NULL,
    template_name text NOT NULL,
    template_language text,
    fallback_template text,
    total_rows integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    read_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    fallback_sent_count integer DEFAULT 0,
    rows_detail jsonb DEFAULT '[]'::jsonb,
    started_at timestamp with time zone DEFAULT now(),
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    template_body text,
    fallback_body text
);


--
-- Name: meta_inbox_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    phone_number_id text NOT NULL,
    waba_id text,
    access_token text NOT NULL,
    token_type text DEFAULT 'permanent'::text NOT NULL,
    phone_display text,
    status text DEFAULT 'pending'::text NOT NULL,
    webhook_verify_token text DEFAULT (gen_random_uuid())::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ticket_enabled boolean DEFAULT false NOT NULL,
    ticket_pipeline_id uuid,
    ticket_estagio_id uuid,
    ticket_prioridade text DEFAULT 'medium'::text NOT NULL
);


--
-- Name: COLUMN meta_inbox_accounts.ticket_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meta_inbox_accounts.ticket_enabled IS 'Se true, conversas nesta conta podem gerar tickets no CRM.';


--
-- Name: COLUMN meta_inbox_accounts.ticket_pipeline_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meta_inbox_accounts.ticket_pipeline_id IS 'Pipeline de tickets onde os tickets serão criados.';


--
-- Name: COLUMN meta_inbox_accounts.ticket_estagio_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meta_inbox_accounts.ticket_estagio_id IS 'Estágio inicial dos tickets criados.';


--
-- Name: COLUMN meta_inbox_accounts.ticket_prioridade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meta_inbox_accounts.ticket_prioridade IS 'Prioridade padrão dos tickets: low, medium, high, urgent.';


--
-- Name: meta_inbox_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    contact_phone text NOT NULL,
    contact_name text,
    contact_profile_pic text,
    last_message text,
    last_message_ts timestamp with time zone,
    last_message_from_me boolean DEFAULT false,
    unread_count integer DEFAULT 0,
    last_inbound_ts timestamp with time zone,
    assigned_user_id uuid,
    tags text[] DEFAULT '{}'::text[],
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    total_messages_in integer DEFAULT 0,
    total_messages_out integer DEFAULT 0,
    first_response_at timestamp with time zone,
    first_response_ms bigint,
    resolved_at timestamp with time zone,
    participants_out text[] DEFAULT '{}'::text[],
    pinned boolean DEFAULT false,
    pinned_at timestamp with time zone,
    muted boolean DEFAULT false,
    favorited boolean DEFAULT false
);


--
-- Name: meta_inbox_macros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_macros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    conteudo text,
    media_url text,
    media_nome text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    account_ids uuid[] DEFAULT '{}'::uuid[]
);


--
-- Name: meta_inbox_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    account_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    wamid text,
    from_me boolean DEFAULT false NOT NULL,
    from_phone text,
    to_phone text,
    msg_type text DEFAULT 'text'::text NOT NULL,
    body text,
    caption text,
    media_url text,
    media_mime text,
    media_id text,
    media_filename text,
    template_name text,
    template_language text,
    template_components jsonb,
    status text DEFAULT 'sent'::text,
    error_code text,
    error_message text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    failed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    sent_by_user_id uuid
);


--
-- Name: COLUMN meta_inbox_messages.sent_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.meta_inbox_messages.sent_by_user_id IS 'UUID do usuário que enviou a mensagem. NULL para mensagens recebidas.';


--
-- Name: meta_inbox_metrics_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_metrics_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    date date NOT NULL,
    messages_in integer DEFAULT 0,
    messages_out integer DEFAULT 0,
    conversations_opened integer DEFAULT 0,
    conversations_resolved integer DEFAULT 0,
    avg_first_response_ms bigint,
    max_first_response_ms bigint,
    min_first_response_ms bigint,
    unique_contacts integer DEFAULT 0,
    templates_sent integer DEFAULT 0,
    media_sent integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: meta_inbox_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#8B5CF6'::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now(),
    account_ids uuid[] DEFAULT '{}'::uuid[]
);


--
-- Name: meta_inbox_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    meta_template_id text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    category text DEFAULT 'UTILITY'::text NOT NULL,
    language text DEFAULT 'pt_BR'::text NOT NULL,
    components jsonb DEFAULT '[]'::jsonb,
    quality_score text DEFAULT 'UNKNOWN'::text,
    rejected_reason text,
    synced_at timestamp with time zone DEFAULT now(),
    display_name text,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true
);


--
-- Name: meta_inbox_user_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox_user_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid NOT NULL,
    account_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: agente_arquivos; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.agente_arquivos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agente_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    tipo_mime text NOT NULL,
    tamanho bigint DEFAULT 0,
    storage_path text NOT NULL,
    texto_extraido text DEFAULT ''::text,
    criado_em timestamp with time zone DEFAULT now()
);


--
-- Name: agentes_ia; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.agentes_ia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    parent_id uuid,
    tipo text NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text,
    prompt_sistema text DEFAULT ''::text NOT NULL,
    criterios jsonb DEFAULT '[]'::jsonb NOT NULL,
    modelo_ia text DEFAULT 'gpt-4o-mini'::text,
    temperatura numeric(3,2) DEFAULT 0.0,
    ordem integer DEFAULT 0,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    modulo text DEFAULT 'meetings'::text NOT NULL,
    CONSTRAINT agentes_ia_modulo_check CHECK ((modulo = ANY (ARRAY['meetings'::text, 'whatsapp'::text]))),
    CONSTRAINT agentes_ia_tipo_check CHECK ((tipo = ANY (ARRAY['gerente'::text, 'classificador'::text, 'avaliador'::text, 'sentimental'::text, 'produto'::text])))
);


--
-- Name: analises_ia; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.analises_ia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    tipo_contexto text NOT NULL,
    entidade_id uuid,
    score smallint,
    criterios jsonb,
    resumo text,
    payload jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    vendedor_id uuid,
    instancia_nome text,
    contato_telefone text,
    periodo_ref date,
    agente_avaliador_id uuid,
    tipo_reuniao_detectado text,
    chain_log jsonb,
    CONSTRAINT analises_ia_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT analises_ia_tipo_contexto_check CHECK ((tipo_contexto = ANY (ARRAY['reuniao'::text, 'whatsapp'::text, 'treinamento'::text, 'relatorio'::text])))
);


--
-- Name: areas; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    gerente_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automacoes_webhooks; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.automacoes_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    evento text NOT NULL,
    categoria text NOT NULL,
    url_webhook text,
    ativo boolean DEFAULT true NOT NULL,
    timeout_ms integer DEFAULT 10000 NOT NULL,
    tentativas_max integer DEFAULT 3 NOT NULL,
    headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avaliacoes_reunioes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.avaliacoes_reunioes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reuniao_id uuid NOT NULL,
    avaliador_id uuid,
    rapport smallint NOT NULL,
    discovery smallint NOT NULL,
    presentation smallint NOT NULL,
    objections smallint NOT NULL,
    next_steps smallint NOT NULL,
    score_total smallint NOT NULL,
    notas text,
    resumo_ia text,
    insights_ia text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT avaliacoes_reunioes_discovery_check CHECK (((discovery >= 0) AND (discovery <= 100))),
    CONSTRAINT avaliacoes_reunioes_next_steps_check CHECK (((next_steps >= 0) AND (next_steps <= 100))),
    CONSTRAINT avaliacoes_reunioes_objections_check CHECK (((objections >= 0) AND (objections <= 100))),
    CONSTRAINT avaliacoes_reunioes_presentation_check CHECK (((presentation >= 0) AND (presentation <= 100))),
    CONSTRAINT avaliacoes_reunioes_rapport_check CHECK (((rapport >= 0) AND (rapport <= 100))),
    CONSTRAINT avaliacoes_reunioes_score_total_check CHECK (((score_total >= 0) AND (score_total <= 100)))
);


--
-- Name: comentarios_reuniao; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.comentarios_reuniao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    reuniao_id uuid NOT NULL,
    autor_id uuid,
    autor_nome text,
    conteudo text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configuracoes_ia; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.configuracoes_ia (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    modulo_codigo text NOT NULL,
    criterios jsonb DEFAULT '[]'::jsonb,
    prompt_sistema text DEFAULT ''::text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now(),
    palavras_proibidas jsonb DEFAULT '[]'::jsonb
);


--
-- Name: configuracoes_modulos_empresa; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.configuracoes_modulos_empresa (
    id bigint NOT NULL,
    empresa_id uuid NOT NULL,
    modulo_codigo text NOT NULL,
    habilitado boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configuracoes_modulos_empresa_id_seq; Type: SEQUENCE; Schema: saas; Owner: -
--

CREATE SEQUENCE saas.configuracoes_modulos_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracoes_modulos_empresa_id_seq; Type: SEQUENCE OWNED BY; Schema: saas; Owner: -
--

ALTER SEQUENCE saas.configuracoes_modulos_empresa_id_seq OWNED BY saas.configuracoes_modulos_empresa.id;


--
-- Name: configuracoes_modulos_usuario; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.configuracoes_modulos_usuario (
    id bigint NOT NULL,
    usuario_id uuid NOT NULL,
    modulo_codigo text NOT NULL,
    habilitado boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configuracoes_modulos_usuario_id_seq; Type: SEQUENCE; Schema: saas; Owner: -
--

CREATE SEQUENCE saas.configuracoes_modulos_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracoes_modulos_usuario_id_seq; Type: SEQUENCE OWNED BY; Schema: saas; Owner: -
--

ALTER SEQUENCE saas.configuracoes_modulos_usuario_id_seq OWNED BY saas.configuracoes_modulos_usuario.id;


--
-- Name: conversas_whatsapp; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.conversas_whatsapp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instancia_id uuid NOT NULL,
    contato_nome text,
    contato_telefone text NOT NULL,
    contato_avatar_url text,
    ultima_mensagem text,
    ultima_mensagem_em timestamp with time zone,
    nao_lidas integer DEFAULT 0 NOT NULL,
    responsavel_usuario_id uuid,
    score smallint,
    analisada_por_ia boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversas_whatsapp_score_check CHECK (((score >= 0) AND (score <= 100)))
);


--
-- Name: crm_ai_conversations; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    entidade_tipo text NOT NULL,
    entidade_id uuid NOT NULL,
    estagio_id uuid,
    contato_id uuid,
    contato_telefone text,
    provider text DEFAULT 'evolution'::text NOT NULL,
    instancia text,
    status text DEFAULT 'active'::text NOT NULL,
    mensagens jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_mensagens integer DEFAULT 0 NOT NULL,
    ultima_mensagem_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_ai_conversations; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_ai_conversations IS 'Memória de conversas IA do CRM. Uma conversa por entidade+estágio com histórico de mensagens para manter contexto.';


--
-- Name: crm_associacoes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_associacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    origem_tipo text NOT NULL,
    origem_id uuid NOT NULL,
    destino_tipo text NOT NULL,
    destino_id uuid NOT NULL,
    tipo_associacao text DEFAULT 'default'::text NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_associacoes; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_associacoes IS 'Associacoes N:N entre objetos CRM (contact, company, deal, ticket)';


--
-- Name: crm_atividades; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_atividades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    tipo saas.tipo_atividade_crm NOT NULL,
    titulo text,
    conteudo text,
    email_para text,
    email_de text,
    email_cc text,
    email_assunto text,
    chamada_duracao integer,
    chamada_resultado text,
    chamada_direcao text,
    tarefa_status saas.status_tarefa DEFAULT 'pendente'::saas.status_tarefa,
    tarefa_prioridade text DEFAULT 'nenhum'::text,
    tarefa_tipo text DEFAULT 'tarefas'::text,
    tarefa_fila text,
    tarefa_data_vencimento timestamp with time zone,
    tarefa_lembrete timestamp with time zone,
    tarefa_repetir boolean DEFAULT false,
    reuniao_inicio timestamp with time zone,
    reuniao_fim timestamp with time zone,
    reuniao_tipo text,
    reuniao_localizacao text,
    reuniao_participantes jsonb DEFAULT '[]'::jsonb,
    reuniao_lembretes jsonb DEFAULT '[]'::jsonb,
    criado_por uuid,
    atribuido_para uuid,
    contato_ids uuid[] DEFAULT '{}'::uuid[],
    empresa_crm_ids uuid[] DEFAULT '{}'::uuid[],
    negocio_ids uuid[] DEFAULT '{}'::uuid[],
    ticket_ids uuid[] DEFAULT '{}'::uuid[],
    data_atividade timestamp with time zone DEFAULT now() NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_atividades; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_atividades IS 'Atividades CRM unificadas: notas, emails, chamadas, tarefas, reuniões, WhatsApp, SMS, LinkedIn';


--
-- Name: crm_contatos; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_contatos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_registro text NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    email public.citext,
    telefone text,
    cargo text,
    avatar_url text,
    status saas.status_contato DEFAULT 'lead'::saas.status_contato NOT NULL,
    fonte saas.fonte_contato DEFAULT 'outros'::saas.fonte_contato,
    score integer DEFAULT 0,
    tags text[] DEFAULT '{}'::text[],
    proprietario_id uuid,
    dados_custom jsonb DEFAULT '{}'::jsonb,
    ultima_atividade_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    deletado_em timestamp with time zone,
    CONSTRAINT crm_contatos_score_check CHECK (((score >= 0) AND (score <= 100)))
);


--
-- Name: TABLE crm_contatos; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_contatos IS 'Contatos CRM (object_type_id=0-1). URL: /record/0-1/{numero_registro}. Formato: L+10D+L (ex: A1234567890B)';


--
-- Name: crm_empresas; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_registro text NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    dominio public.citext,
    cnpj text,
    telefone text,
    website text,
    logo_url text,
    endereco text,
    cidade text,
    estado text,
    pais text DEFAULT 'Brazil'::text,
    cep text,
    setor text,
    porte text,
    plataforma text,
    tags text[] DEFAULT '{}'::text[],
    proprietario_id uuid,
    empresa_pai_id uuid,
    dados_custom jsonb DEFAULT '{}'::jsonb,
    ultima_atividade_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    deletado_em timestamp with time zone
);


--
-- Name: TABLE crm_empresas; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_empresas IS 'Empresas/Contas CRM externas (object_type_id=0-2). URL: /record/0-2/{numero_registro}. Formato: L+10D+L';


--
-- Name: crm_estagio_ia_config; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_estagio_ia_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    estagio_id uuid NOT NULL,
    ativo boolean DEFAULT false NOT NULL,
    provider text DEFAULT 'evolution'::text,
    instancia_id text,
    instancia_modo text DEFAULT 'owner'::text,
    prompt_sistema text DEFAULT ''::text,
    auto_complemento text DEFAULT ''::text,
    mensagem_boas_vindas jsonb DEFAULT '[]'::jsonb,
    modo_inicio text DEFAULT 'automatic'::text,
    delay_digitacao integer DEFAULT 0,
    delay_resposta integer DEFAULT 3,
    modelo_ia text DEFAULT 'gpt-4o-mini'::text,
    temperatura numeric(3,2) DEFAULT 0.7,
    perguntas jsonb DEFAULT '[]'::jsonb,
    followups jsonb DEFAULT '[]'::jsonb,
    rag_ativo boolean DEFAULT false,
    rag_fonte text,
    rag_max_turnos integer DEFAULT 10,
    transicoes jsonb DEFAULT '[]'::jsonb,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    nome_ia text DEFAULT ''::text
);


--
-- Name: TABLE crm_estagio_ia_config; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_estagio_ia_config IS 'Configuração de IA por estágio de pipeline (Deals e Tickets). Cada estágio pode ter seu próprio agente IA com prompt, follow-ups, perguntas e transições.';


--
-- Name: crm_historico_estagios; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_historico_estagios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    entidade_tipo text NOT NULL,
    entidade_id uuid NOT NULL,
    estagio_anterior_id uuid,
    estagio_novo_id uuid,
    realizado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_historico_estagios; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_historico_estagios IS 'Historico de mudancas de estagio em deals e tickets';


--
-- Name: crm_negocios; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_negocios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_registro text NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    valor numeric(14,2) DEFAULT 0,
    moeda text DEFAULT 'BRL'::text,
    pipeline_id uuid,
    estagio_id uuid,
    probabilidade integer DEFAULT 0,
    status saas.status_negocio DEFAULT 'aberto'::saas.status_negocio NOT NULL,
    motivo_perda text,
    data_fechamento_prevista date,
    data_fechamento date,
    proprietario_id uuid,
    plataforma text,
    tags text[] DEFAULT '{}'::text[],
    dados_custom jsonb DEFAULT '{}'::jsonb,
    ultima_atividade_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    deletado_em timestamp with time zone,
    contato_principal_id uuid,
    CONSTRAINT crm_negocios_probabilidade_check CHECK (((probabilidade >= 0) AND (probabilidade <= 100)))
);


--
-- Name: TABLE crm_negocios; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_negocios IS 'Negocios/Deals CRM (object_type_id=0-3). URL: /record/0-3/{numero_registro}. Formato: L+10D+L';


--
-- Name: COLUMN crm_negocios.contato_principal_id; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.crm_negocios.contato_principal_id IS 'Contato principal do negócio — destinatário das mensagens da IA';


--
-- Name: crm_notas; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_notas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    entidade_tipo text NOT NULL,
    entidade_id uuid NOT NULL,
    conteudo text NOT NULL,
    criado_por uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_notas; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_notas IS 'Notas/comentarios em qualquer objeto CRM';


--
-- Name: crm_pipeline_estagios; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_pipeline_estagios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    nome text NOT NULL,
    cor text DEFAULT '#6B7280'::text,
    ordem integer DEFAULT 0 NOT NULL,
    probabilidade integer DEFAULT 0,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    nome_interno bigint NOT NULL,
    CONSTRAINT crm_pipeline_estagios_probabilidade_check CHECK (((probabilidade >= 0) AND (probabilidade <= 100)))
);


--
-- Name: TABLE crm_pipeline_estagios; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_pipeline_estagios IS 'Estagios/colunas de cada pipeline (kanban)';


--
-- Name: crm_pipelines; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    tipo text DEFAULT 'deal'::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    nome_interno bigint NOT NULL
);


--
-- Name: TABLE crm_pipelines; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_pipelines IS 'Pipelines configuraveis para deals e tickets';


--
-- Name: crm_ticket_owner_history; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_ticket_owner_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ticket_id uuid NOT NULL,
    usuario_id uuid,
    usuario_nome text,
    atribuido_por uuid,
    inicio_em timestamp with time zone DEFAULT now() NOT NULL,
    fim_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE crm_ticket_owner_history; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_ticket_owner_history IS 'Auditoria de trocas de proprietário em tickets. Permite calcular tempo de atendimento por pessoa.';


--
-- Name: crm_tickets; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.crm_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero_registro text NOT NULL,
    empresa_id uuid NOT NULL,
    titulo text NOT NULL,
    descricao text,
    pipeline_id uuid,
    estagio_id uuid,
    prioridade saas.prioridade_ticket DEFAULT 'medium'::saas.prioridade_ticket NOT NULL,
    status saas.status_ticket DEFAULT 'aberto'::saas.status_ticket NOT NULL,
    categoria text,
    plataforma text,
    tags text[] DEFAULT '{}'::text[],
    proprietario_id uuid,
    sla_minutos integer,
    primeira_resposta_em timestamp with time zone,
    dados_custom jsonb DEFAULT '{}'::jsonb,
    ultima_atividade_em timestamp with time zone,
    resolvido_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    deletado_em timestamp with time zone,
    contato_principal_id uuid
);


--
-- Name: TABLE crm_tickets; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.crm_tickets IS 'Tickets CRM (object_type_id=0-4). URL: /record/0-4/{numero_registro}. Formato: L+10D+L';


--
-- Name: COLUMN crm_tickets.contato_principal_id; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.crm_tickets.contato_principal_id IS 'Contato principal do ticket — destinatário das mensagens da IA';


--
-- Name: empresas; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.empresas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    dominio public.citext,
    logo_url text,
    plano saas.tipo_plano DEFAULT 'enterprise'::saas.tipo_plano NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    subtitulo text DEFAULT 'Revenue OS'::text
);


--
-- Name: eventos_webhooks; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.eventos_webhooks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    automacao_id uuid,
    empresa_id uuid NOT NULL,
    evento text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    ultimo_erro text,
    processado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT eventos_webhooks_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'sucesso'::text, 'erro'::text])))
);


--
-- Name: fila_avaliacoes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.fila_avaliacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    reuniao_id uuid NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    tentativas integer DEFAULT 0,
    erro text,
    criado_em timestamp with time zone DEFAULT now(),
    processado_em timestamp with time zone,
    CONSTRAINT fila_avaliacoes_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'processando'::text, 'concluida'::text, 'erro'::text])))
);


--
-- Name: instancias_whatsapp; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.instancias_whatsapp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid,
    time_id uuid,
    nome text NOT NULL,
    telefone text,
    status saas.status_instancia_whatsapp DEFAULT 'desconectada'::saas.status_instancia_whatsapp NOT NULL,
    qr_code text,
    owner_jid text,
    ultimo_evento_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: integracoes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.integracoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid,
    tipo saas.tipo_integracao NOT NULL,
    nome text NOT NULL,
    status saas.status_integracao DEFAULT 'desconectada'::saas.status_integracao NOT NULL,
    configuracao jsonb DEFAULT '{}'::jsonb NOT NULL,
    conectado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: logs_auditoria; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.logs_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid,
    tipo_evento text NOT NULL,
    pagina text,
    pagina_label text,
    ip_origem inet,
    user_agent text,
    metadados jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: meet_conferences; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.meet_conferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid,
    source text DEFAULT 'reports_meet'::text NOT NULL,
    conference_key text NOT NULL,
    meeting_code text,
    organizer_email text,
    participants jsonb,
    source_org_unit text,
    call_interna boolean,
    title text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    status text DEFAULT 'NEW'::text NOT NULL,
    transcript_source_file_id text,
    transcript_copied_file_id text,
    transcript_text text,
    attempts integer DEFAULT 0 NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recording_source_file_id text,
    recording_copied_file_id text,
    recording_name text,
    recording_mime_type text,
    recording_size_bytes bigint,
    recording_web_view_link text,
    recording_web_content_link text
);


--
-- Name: mensagens_whatsapp; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.mensagens_whatsapp (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversa_id uuid NOT NULL,
    instancia_id uuid NOT NULL,
    de_jid text,
    para_jid text,
    corpo text,
    tipo text DEFAULT 'texto'::text NOT NULL,
    direcao text NOT NULL,
    external_message_id text,
    enviada_em timestamp with time zone NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mensagens_whatsapp_direcao_check CHECK ((direcao = ANY (ARRAY['entrada'::text, 'saida'::text])))
);


--
-- Name: modulos_sistema; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.modulos_sistema (
    codigo text NOT NULL,
    nome text NOT NULL,
    descricao text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notificacoes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    tipo saas.tipo_notificacao NOT NULL,
    titulo text NOT NULL,
    descricao text,
    link text,
    status saas.status_notificacao DEFAULT 'nao_lida'::saas.status_notificacao NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    lida_em timestamp with time zone
);


--
-- Name: permissoes_papeis; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.permissoes_papeis (
    id bigint NOT NULL,
    papel saas.papel_usuario NOT NULL,
    recurso text NOT NULL,
    escopo saas.escopo_permissao DEFAULT 'proprio'::saas.escopo_permissao NOT NULL,
    permitido boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: permissoes_papeis_id_seq; Type: SEQUENCE; Schema: saas; Owner: -
--

CREATE SEQUENCE saas.permissoes_papeis_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permissoes_papeis_id_seq; Type: SEQUENCE OWNED BY; Schema: saas; Owner: -
--

ALTER SEQUENCE saas.permissoes_papeis_id_seq OWNED BY saas.permissoes_papeis.id;


--
-- Name: reunioes; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.reunioes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    area_id uuid,
    time_id uuid,
    vendedor_id uuid,
    titulo text NOT NULL,
    data_reuniao timestamp with time zone NOT NULL,
    duracao_minutos integer NOT NULL,
    cliente_nome text,
    cliente_email public.citext,
    link_meet text,
    status saas.status_reuniao DEFAULT 'agendada'::saas.status_reuniao NOT NULL,
    score smallint,
    analisada_por_ia boolean DEFAULT false NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    google_event_id text,
    participantes jsonb DEFAULT '[]'::jsonb,
    transcricao text,
    transcript_file_id text,
    sentimento text,
    auditoria_manual boolean DEFAULT false,
    arquivo_original text,
    gravacao_file_id text,
    gravacao_nome text,
    gravacao_link text,
    CONSTRAINT reunioes_duracao_minutos_check CHECK ((duracao_minutos >= 0)),
    CONSTRAINT reunioes_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT reunioes_sentimento_check CHECK (((sentimento IS NULL) OR (sentimento = ANY (ARRAY['Positivo'::text, 'Neutro'::text, 'Negativo'::text, 'Preocupado'::text, 'Frustrado'::text]))))
);


--
-- Name: COLUMN reunioes.transcript_file_id; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.reunioes.transcript_file_id IS 'Google Drive file ID of the transcript document (from meet_conferences.transcript_copied_file_id)';


--
-- Name: COLUMN reunioes.gravacao_file_id; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.reunioes.gravacao_file_id IS 'Google Drive file ID da gravacao (preferencialmente arquivo copiado para pasta central).';


--
-- Name: COLUMN reunioes.gravacao_nome; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.reunioes.gravacao_nome IS 'Nome do arquivo de gravacao no Google Drive.';


--
-- Name: COLUMN reunioes.gravacao_link; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON COLUMN saas.reunioes.gravacao_link IS 'Link web para visualizacao/download da gravacao.';


--
-- Name: run_conference_api_logs; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.run_conference_api_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conference_key text,
    status_code integer NOT NULL,
    ok boolean DEFAULT false NOT NULL,
    duplicated boolean,
    error text,
    request_ip text,
    user_agent text,
    request_query jsonb,
    request_body jsonb,
    response_payload jsonb,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitacoes_acesso; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.solicitacoes_acesso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    email public.citext NOT NULL,
    nome text NOT NULL,
    foto_url text,
    status saas.status_solicitacao_acesso DEFAULT 'pendente'::saas.status_solicitacao_acesso NOT NULL,
    papel_sugerido saas.papel_usuario,
    solicitado_em timestamp with time zone DEFAULT now() NOT NULL,
    decidido_em timestamp with time zone,
    decidido_por_usuario_id uuid,
    observacoes text
);


--
-- Name: TABLE solicitacoes_acesso; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.solicitacoes_acesso IS 'Fila de triagem para usuarios do dominio sem aprovacao previa.';


--
-- Name: times; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.times (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    area_id uuid,
    nome text NOT NULL,
    supervisor_id uuid,
    meta numeric(12,2),
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tokens_ia_modulo; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.tokens_ia_modulo (
    id bigint NOT NULL,
    empresa_id uuid NOT NULL,
    modulo_codigo text NOT NULL,
    provedor text DEFAULT 'openai'::text NOT NULL,
    modelo text,
    token_criptografado text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tokens_ia_modulo; Type: COMMENT; Schema: saas; Owner: -
--

COMMENT ON TABLE saas.tokens_ia_modulo IS 'Guarda tokens e modelos por modulo. O token deve ser salvo criptografado.';


--
-- Name: tokens_ia_modulo_id_seq; Type: SEQUENCE; Schema: saas; Owner: -
--

CREATE SEQUENCE saas.tokens_ia_modulo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tokens_ia_modulo_id_seq; Type: SEQUENCE OWNED BY; Schema: saas; Owner: -
--

ALTER SEQUENCE saas.tokens_ia_modulo_id_seq OWNED BY saas.tokens_ia_modulo.id;


--
-- Name: usuarios; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    area_id uuid,
    time_id uuid,
    nome text NOT NULL,
    email public.citext NOT NULL,
    avatar_url text,
    papel text DEFAULT 'vendedor'::saas.papel_usuario NOT NULL,
    status saas.status_usuario DEFAULT 'ativo'::saas.status_usuario NOT NULL,
    senha_hash text,
    google_sub text,
    ultimo_login_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_chat_settings; Type: TABLE; Schema: saas; Owner: -
--

CREATE TABLE saas.whatsapp_chat_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    instancia text NOT NULL,
    telefone text NOT NULL,
    responsavel_id uuid,
    nome_customizado text,
    criado_em timestamp with time zone DEFAULT now(),
    atualizado_em timestamp with time zone DEFAULT now()
);


--
-- Name: configuracoes_modulos_empresa id; Type: DEFAULT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_empresa ALTER COLUMN id SET DEFAULT nextval('saas.configuracoes_modulos_empresa_id_seq'::regclass);


--
-- Name: configuracoes_modulos_usuario id; Type: DEFAULT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_usuario ALTER COLUMN id SET DEFAULT nextval('saas.configuracoes_modulos_usuario_id_seq'::regclass);


--
-- Name: permissoes_papeis id; Type: DEFAULT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.permissoes_papeis ALTER COLUMN id SET DEFAULT nextval('saas.permissoes_papeis_id_seq'::regclass);


--
-- Name: tokens_ia_modulo id; Type: DEFAULT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.tokens_ia_modulo ALTER COLUMN id SET DEFAULT nextval('saas.tokens_ia_modulo_id_seq'::regclass);


--
-- Name: meta_bulk_send_logs meta_bulk_send_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_bulk_send_logs
    ADD CONSTRAINT meta_bulk_send_logs_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_accounts meta_inbox_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_accounts
    ADD CONSTRAINT meta_inbox_accounts_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_conversations meta_inbox_conversations_account_id_contact_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_conversations
    ADD CONSTRAINT meta_inbox_conversations_account_id_contact_phone_key UNIQUE (account_id, contact_phone);


--
-- Name: meta_inbox_conversations meta_inbox_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_conversations
    ADD CONSTRAINT meta_inbox_conversations_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_macros meta_inbox_macros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_macros
    ADD CONSTRAINT meta_inbox_macros_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_messages meta_inbox_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_messages
    ADD CONSTRAINT meta_inbox_messages_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_metrics_daily meta_inbox_metrics_daily_account_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_metrics_daily
    ADD CONSTRAINT meta_inbox_metrics_daily_account_id_date_key UNIQUE (account_id, date);


--
-- Name: meta_inbox_metrics_daily meta_inbox_metrics_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_metrics_daily
    ADD CONSTRAINT meta_inbox_metrics_daily_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_tags meta_inbox_tags_empresa_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_tags
    ADD CONSTRAINT meta_inbox_tags_empresa_nome_key UNIQUE (empresa_id, nome);


--
-- Name: meta_inbox_tags meta_inbox_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_tags
    ADD CONSTRAINT meta_inbox_tags_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_templates meta_inbox_templates_account_id_meta_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_templates
    ADD CONSTRAINT meta_inbox_templates_account_id_meta_template_id_key UNIQUE (account_id, meta_template_id);


--
-- Name: meta_inbox_templates meta_inbox_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_templates
    ADD CONSTRAINT meta_inbox_templates_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_user_access meta_inbox_user_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_user_access
    ADD CONSTRAINT meta_inbox_user_access_pkey PRIMARY KEY (id);


--
-- Name: meta_inbox_user_access meta_inbox_user_access_usuario_id_account_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_user_access
    ADD CONSTRAINT meta_inbox_user_access_usuario_id_account_id_key UNIQUE (usuario_id, account_id);


--
-- Name: agente_arquivos agente_arquivos_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agente_arquivos
    ADD CONSTRAINT agente_arquivos_pkey PRIMARY KEY (id);


--
-- Name: agentes_ia agentes_ia_empresa_id_parent_id_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agentes_ia
    ADD CONSTRAINT agentes_ia_empresa_id_parent_id_nome_key UNIQUE (empresa_id, parent_id, nome);


--
-- Name: agentes_ia agentes_ia_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agentes_ia
    ADD CONSTRAINT agentes_ia_pkey PRIMARY KEY (id);


--
-- Name: analises_ia analises_ia_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.analises_ia
    ADD CONSTRAINT analises_ia_pkey PRIMARY KEY (id);


--
-- Name: areas areas_empresa_id_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.areas
    ADD CONSTRAINT areas_empresa_id_nome_key UNIQUE (empresa_id, nome);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: automacoes_webhooks automacoes_webhooks_empresa_id_evento_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.automacoes_webhooks
    ADD CONSTRAINT automacoes_webhooks_empresa_id_evento_key UNIQUE (empresa_id, evento);


--
-- Name: automacoes_webhooks automacoes_webhooks_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.automacoes_webhooks
    ADD CONSTRAINT automacoes_webhooks_pkey PRIMARY KEY (id);


--
-- Name: avaliacoes_reunioes avaliacoes_reunioes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.avaliacoes_reunioes
    ADD CONSTRAINT avaliacoes_reunioes_pkey PRIMARY KEY (id);


--
-- Name: avaliacoes_reunioes avaliacoes_reunioes_reuniao_id_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.avaliacoes_reunioes
    ADD CONSTRAINT avaliacoes_reunioes_reuniao_id_key UNIQUE (reuniao_id);


--
-- Name: comentarios_reuniao comentarios_reuniao_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.comentarios_reuniao
    ADD CONSTRAINT comentarios_reuniao_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_ia configuracoes_ia_empresa_id_modulo_codigo_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_ia
    ADD CONSTRAINT configuracoes_ia_empresa_id_modulo_codigo_key UNIQUE (empresa_id, modulo_codigo);


--
-- Name: configuracoes_ia configuracoes_ia_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_ia
    ADD CONSTRAINT configuracoes_ia_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_modulos_empresa configuracoes_modulos_empresa_empresa_id_modulo_codigo_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_empresa
    ADD CONSTRAINT configuracoes_modulos_empresa_empresa_id_modulo_codigo_key UNIQUE (empresa_id, modulo_codigo);


--
-- Name: configuracoes_modulos_empresa configuracoes_modulos_empresa_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_empresa
    ADD CONSTRAINT configuracoes_modulos_empresa_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_modulos_usuario configuracoes_modulos_usuario_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_usuario
    ADD CONSTRAINT configuracoes_modulos_usuario_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_modulos_usuario configuracoes_modulos_usuario_usuario_id_modulo_codigo_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_usuario
    ADD CONSTRAINT configuracoes_modulos_usuario_usuario_id_modulo_codigo_key UNIQUE (usuario_id, modulo_codigo);


--
-- Name: conversas_whatsapp conversas_whatsapp_instancia_id_contato_telefone_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.conversas_whatsapp
    ADD CONSTRAINT conversas_whatsapp_instancia_id_contato_telefone_key UNIQUE (instancia_id, contato_telefone);


--
-- Name: conversas_whatsapp conversas_whatsapp_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.conversas_whatsapp
    ADD CONSTRAINT conversas_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: crm_ai_conversations crm_ai_conversations_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ai_conversations
    ADD CONSTRAINT crm_ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: crm_associacoes crm_associacoes_empresa_id_origem_tipo_origem_id_destino_ti_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_associacoes
    ADD CONSTRAINT crm_associacoes_empresa_id_origem_tipo_origem_id_destino_ti_key UNIQUE (empresa_id, origem_tipo, origem_id, destino_tipo, destino_id, tipo_associacao);


--
-- Name: crm_associacoes crm_associacoes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_associacoes
    ADD CONSTRAINT crm_associacoes_pkey PRIMARY KEY (id);


--
-- Name: crm_atividades crm_atividades_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_atividades
    ADD CONSTRAINT crm_atividades_pkey PRIMARY KEY (id);


--
-- Name: crm_contatos crm_contatos_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_contatos
    ADD CONSTRAINT crm_contatos_pkey PRIMARY KEY (id);


--
-- Name: crm_empresas crm_empresas_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_empresas
    ADD CONSTRAINT crm_empresas_pkey PRIMARY KEY (id);


--
-- Name: crm_estagio_ia_config crm_estagio_ia_config_estagio_id_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_estagio_ia_config
    ADD CONSTRAINT crm_estagio_ia_config_estagio_id_key UNIQUE (estagio_id);


--
-- Name: crm_estagio_ia_config crm_estagio_ia_config_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_estagio_ia_config
    ADD CONSTRAINT crm_estagio_ia_config_pkey PRIMARY KEY (id);


--
-- Name: crm_historico_estagios crm_historico_estagios_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_historico_estagios
    ADD CONSTRAINT crm_historico_estagios_pkey PRIMARY KEY (id);


--
-- Name: crm_negocios crm_negocios_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_pkey PRIMARY KEY (id);


--
-- Name: crm_notas crm_notas_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_notas
    ADD CONSTRAINT crm_notas_pkey PRIMARY KEY (id);


--
-- Name: crm_pipeline_estagios crm_pipeline_estagios_pipeline_id_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipeline_estagios
    ADD CONSTRAINT crm_pipeline_estagios_pipeline_id_nome_key UNIQUE (pipeline_id, nome);


--
-- Name: crm_pipeline_estagios crm_pipeline_estagios_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipeline_estagios
    ADD CONSTRAINT crm_pipeline_estagios_pkey PRIMARY KEY (id);


--
-- Name: crm_pipelines crm_pipelines_empresa_id_nome_tipo_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipelines
    ADD CONSTRAINT crm_pipelines_empresa_id_nome_tipo_key UNIQUE (empresa_id, nome, tipo);


--
-- Name: crm_pipelines crm_pipelines_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipelines
    ADD CONSTRAINT crm_pipelines_pkey PRIMARY KEY (id);


--
-- Name: crm_ticket_owner_history crm_ticket_owner_history_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ticket_owner_history
    ADD CONSTRAINT crm_ticket_owner_history_pkey PRIMARY KEY (id);


--
-- Name: crm_tickets crm_tickets_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_pkey PRIMARY KEY (id);


--
-- Name: empresas empresas_dominio_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.empresas
    ADD CONSTRAINT empresas_dominio_key UNIQUE (dominio);


--
-- Name: empresas empresas_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.empresas
    ADD CONSTRAINT empresas_pkey PRIMARY KEY (id);


--
-- Name: eventos_webhooks eventos_webhooks_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.eventos_webhooks
    ADD CONSTRAINT eventos_webhooks_pkey PRIMARY KEY (id);


--
-- Name: fila_avaliacoes fila_avaliacoes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.fila_avaliacoes
    ADD CONSTRAINT fila_avaliacoes_pkey PRIMARY KEY (id);


--
-- Name: fila_avaliacoes fila_avaliacoes_reuniao_id_status_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.fila_avaliacoes
    ADD CONSTRAINT fila_avaliacoes_reuniao_id_status_key UNIQUE (reuniao_id, status);


--
-- Name: instancias_whatsapp instancias_whatsapp_empresa_id_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.instancias_whatsapp
    ADD CONSTRAINT instancias_whatsapp_empresa_id_nome_key UNIQUE (empresa_id, nome);


--
-- Name: instancias_whatsapp instancias_whatsapp_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.instancias_whatsapp
    ADD CONSTRAINT instancias_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: integracoes integracoes_empresa_id_tipo_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.integracoes
    ADD CONSTRAINT integracoes_empresa_id_tipo_nome_key UNIQUE (empresa_id, tipo, nome);


--
-- Name: integracoes integracoes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.integracoes
    ADD CONSTRAINT integracoes_pkey PRIMARY KEY (id);


--
-- Name: logs_auditoria logs_auditoria_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.logs_auditoria
    ADD CONSTRAINT logs_auditoria_pkey PRIMARY KEY (id);


--
-- Name: meet_conferences meet_conferences_conference_key_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.meet_conferences
    ADD CONSTRAINT meet_conferences_conference_key_key UNIQUE (conference_key);


--
-- Name: meet_conferences meet_conferences_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.meet_conferences
    ADD CONSTRAINT meet_conferences_pkey PRIMARY KEY (id);


--
-- Name: mensagens_whatsapp mensagens_whatsapp_instancia_id_external_message_id_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_instancia_id_external_message_id_key UNIQUE (instancia_id, external_message_id);


--
-- Name: mensagens_whatsapp mensagens_whatsapp_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_pkey PRIMARY KEY (id);


--
-- Name: modulos_sistema modulos_sistema_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.modulos_sistema
    ADD CONSTRAINT modulos_sistema_pkey PRIMARY KEY (codigo);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: permissoes_papeis permissoes_papeis_papel_recurso_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.permissoes_papeis
    ADD CONSTRAINT permissoes_papeis_papel_recurso_key UNIQUE (papel, recurso);


--
-- Name: permissoes_papeis permissoes_papeis_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.permissoes_papeis
    ADD CONSTRAINT permissoes_papeis_pkey PRIMARY KEY (id);


--
-- Name: reunioes reunioes_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.reunioes
    ADD CONSTRAINT reunioes_pkey PRIMARY KEY (id);


--
-- Name: run_conference_api_logs run_conference_api_logs_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.run_conference_api_logs
    ADD CONSTRAINT run_conference_api_logs_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: solicitacoes_acesso solicitacoes_acesso_empresa_id_email_status_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.solicitacoes_acesso
    ADD CONSTRAINT solicitacoes_acesso_empresa_id_email_status_key UNIQUE (empresa_id, email, status);


--
-- Name: solicitacoes_acesso solicitacoes_acesso_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.solicitacoes_acesso
    ADD CONSTRAINT solicitacoes_acesso_pkey PRIMARY KEY (id);


--
-- Name: times times_empresa_id_nome_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.times
    ADD CONSTRAINT times_empresa_id_nome_key UNIQUE (empresa_id, nome);


--
-- Name: times times_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.times
    ADD CONSTRAINT times_pkey PRIMARY KEY (id);


--
-- Name: tokens_ia_modulo tokens_ia_modulo_empresa_id_modulo_codigo_provedor_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.tokens_ia_modulo
    ADD CONSTRAINT tokens_ia_modulo_empresa_id_modulo_codigo_provedor_key UNIQUE (empresa_id, modulo_codigo, provedor);


--
-- Name: tokens_ia_modulo tokens_ia_modulo_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.tokens_ia_modulo
    ADD CONSTRAINT tokens_ia_modulo_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_google_sub_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_google_sub_key UNIQUE (google_sub);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_chat_settings whatsapp_chat_settings_empresa_id_instancia_telefone_key; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.whatsapp_chat_settings
    ADD CONSTRAINT whatsapp_chat_settings_empresa_id_instancia_telefone_key UNIQUE (empresa_id, instancia, telefone);


--
-- Name: whatsapp_chat_settings whatsapp_chat_settings_pkey; Type: CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.whatsapp_chat_settings
    ADD CONSTRAINT whatsapp_chat_settings_pkey PRIMARY KEY (id);


--
-- Name: idx_macros_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_macros_account ON public.meta_inbox_macros USING btree (account_id);


--
-- Name: idx_macros_account_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_macros_account_ids ON public.meta_inbox_macros USING gin (account_ids);


--
-- Name: idx_meta_conv_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_conv_account ON public.meta_inbox_conversations USING btree (account_id);


--
-- Name: idx_meta_conv_account_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_conv_account_created ON public.meta_inbox_conversations USING btree (account_id, created_at);


--
-- Name: idx_meta_conv_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_conv_empresa ON public.meta_inbox_conversations USING btree (empresa_id);


--
-- Name: idx_meta_conv_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_conv_phone ON public.meta_inbox_conversations USING btree (account_id, contact_phone);


--
-- Name: idx_meta_inbox_messages_sent_by_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_inbox_messages_sent_by_user ON public.meta_inbox_messages USING btree (sent_by_user_id) WHERE (sent_by_user_id IS NOT NULL);


--
-- Name: idx_meta_metrics_daily_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_metrics_daily_account_date ON public.meta_inbox_metrics_daily USING btree (account_id, date);


--
-- Name: idx_meta_msg_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_msg_account ON public.meta_inbox_messages USING btree (account_id);


--
-- Name: idx_meta_msg_conv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_msg_conv ON public.meta_inbox_messages USING btree (conversation_id);


--
-- Name: idx_meta_msg_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_msg_status ON public.meta_inbox_messages USING btree (status);


--
-- Name: idx_meta_msg_wamid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_msg_wamid ON public.meta_inbox_messages USING btree (wamid);


--
-- Name: idx_meta_tmpl_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_tmpl_account ON public.meta_inbox_templates USING btree (account_id);


--
-- Name: idx_meta_tmpl_display; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_tmpl_display ON public.meta_inbox_templates USING btree (account_id, display_name, is_active);


--
-- Name: idx_meta_user_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_meta_user_access_user ON public.meta_inbox_user_access USING btree (usuario_id);


--
-- Name: idx_tags_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_account ON public.meta_inbox_tags USING btree (account_id);


--
-- Name: idx_tags_account_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_account_ids ON public.meta_inbox_tags USING gin (account_ids);


--
-- Name: crm_pipeline_estagios_nome_interno_key; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX crm_pipeline_estagios_nome_interno_key ON saas.crm_pipeline_estagios USING btree (nome_interno);


--
-- Name: crm_pipelines_nome_interno_key; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX crm_pipelines_nome_interno_key ON saas.crm_pipelines USING btree (nome_interno);


--
-- Name: idx_agente_arquivos_agente; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_agente_arquivos_agente ON saas.agente_arquivos USING btree (agente_id);


--
-- Name: idx_agentes_ia_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_agentes_ia_empresa ON saas.agentes_ia USING btree (empresa_id);


--
-- Name: idx_agentes_ia_modulo; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_agentes_ia_modulo ON saas.agentes_ia USING btree (empresa_id, modulo);


--
-- Name: idx_agentes_ia_parent; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_agentes_ia_parent ON saas.agentes_ia USING btree (parent_id);


--
-- Name: idx_analises_ia_entidade; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_analises_ia_entidade ON saas.analises_ia USING btree (tipo_contexto, entidade_id);


--
-- Name: idx_analises_ia_entidade_agente; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_analises_ia_entidade_agente ON saas.analises_ia USING btree (tipo_contexto, entidade_id, agente_avaliador_id) WHERE (agente_avaliador_id IS NOT NULL);


--
-- Name: idx_chat_settings_empresa_inst; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_chat_settings_empresa_inst ON saas.whatsapp_chat_settings USING btree (empresa_id, instancia);


--
-- Name: idx_chat_settings_responsavel; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_chat_settings_responsavel ON saas.whatsapp_chat_settings USING btree (responsavel_id);


--
-- Name: idx_comentarios_reuniao; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_comentarios_reuniao ON saas.comentarios_reuniao USING btree (reuniao_id, criado_em DESC);


--
-- Name: idx_conversas_instancia; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_conversas_instancia ON saas.conversas_whatsapp USING btree (instancia_id);


--
-- Name: idx_crm_ai_conv_contato; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_ai_conv_contato ON saas.crm_ai_conversations USING btree (contato_id);


--
-- Name: idx_crm_ai_conv_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_ai_conv_empresa ON saas.crm_ai_conversations USING btree (empresa_id);


--
-- Name: idx_crm_ai_conv_entidade; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_ai_conv_entidade ON saas.crm_ai_conversations USING btree (entidade_tipo, entidade_id, estagio_id);


--
-- Name: idx_crm_associacoes_destino; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_associacoes_destino ON saas.crm_associacoes USING btree (empresa_id, destino_tipo, destino_id);


--
-- Name: idx_crm_associacoes_origem; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_associacoes_origem ON saas.crm_associacoes USING btree (empresa_id, origem_tipo, origem_id);


--
-- Name: idx_crm_associacoes_tipo; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_associacoes_tipo ON saas.crm_associacoes USING btree (empresa_id, tipo_associacao);


--
-- Name: idx_crm_atividades_atribuido; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_atribuido ON saas.crm_atividades USING btree (atribuido_para) WHERE (tarefa_status = 'pendente'::saas.status_tarefa);


--
-- Name: idx_crm_atividades_contatos; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_contatos ON saas.crm_atividades USING gin (contato_ids);


--
-- Name: idx_crm_atividades_criado_por; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_criado_por ON saas.crm_atividades USING btree (criado_por);


--
-- Name: idx_crm_atividades_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_empresa ON saas.crm_atividades USING btree (empresa_id, data_atividade DESC);


--
-- Name: idx_crm_atividades_empresas; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_empresas ON saas.crm_atividades USING gin (empresa_crm_ids);


--
-- Name: idx_crm_atividades_negocios; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_negocios ON saas.crm_atividades USING gin (negocio_ids);


--
-- Name: idx_crm_atividades_tarefas_pendentes; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_tarefas_pendentes ON saas.crm_atividades USING btree (empresa_id, tarefa_data_vencimento) WHERE ((tipo = 'tarefa'::saas.tipo_atividade_crm) AND (tarefa_status = 'pendente'::saas.status_tarefa));


--
-- Name: idx_crm_atividades_tickets; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_tickets ON saas.crm_atividades USING gin (ticket_ids);


--
-- Name: idx_crm_atividades_tipo; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_atividades_tipo ON saas.crm_atividades USING btree (empresa_id, tipo);


--
-- Name: idx_crm_contatos_dados_custom; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_dados_custom ON saas.crm_contatos USING gin (dados_custom) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_contatos_email; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_email ON saas.crm_contatos USING btree (empresa_id, email) WHERE ((email IS NOT NULL) AND (deletado_em IS NULL));


--
-- Name: idx_crm_contatos_email_unique; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_contatos_email_unique ON saas.crm_contatos USING btree (empresa_id, lower((email)::text)) WHERE ((email IS NOT NULL) AND (deletado_em IS NULL));


--
-- Name: idx_crm_contatos_empresa_criado; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_empresa_criado ON saas.crm_contatos USING btree (empresa_id, criado_em DESC) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_contatos_empresa_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_empresa_status ON saas.crm_contatos USING btree (empresa_id, status) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_contatos_nome_trgm; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_nome_trgm ON saas.crm_contatos USING gin (nome public.gin_trgm_ops) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_contatos_numero; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_contatos_numero ON saas.crm_contatos USING btree (numero_registro);


--
-- Name: idx_crm_contatos_proprietario; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_proprietario ON saas.crm_contatos USING btree (proprietario_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_contatos_tags; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_contatos_tags ON saas.crm_contatos USING gin (tags) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_empresas_dados_custom; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_dados_custom ON saas.crm_empresas USING gin (dados_custom) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_empresas_dominio; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_dominio ON saas.crm_empresas USING btree (empresa_id, dominio) WHERE ((dominio IS NOT NULL) AND (deletado_em IS NULL));


--
-- Name: idx_crm_empresas_empresa_criado; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_empresa_criado ON saas.crm_empresas USING btree (empresa_id, criado_em DESC) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_empresas_nome_trgm; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_nome_trgm ON saas.crm_empresas USING gin (nome public.gin_trgm_ops) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_empresas_numero; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_empresas_numero ON saas.crm_empresas USING btree (numero_registro);


--
-- Name: idx_crm_empresas_proprietario; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_proprietario ON saas.crm_empresas USING btree (proprietario_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_empresas_tags; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_empresas_tags ON saas.crm_empresas USING gin (tags) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_estagio_ia_config_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_estagio_ia_config_empresa ON saas.crm_estagio_ia_config USING btree (empresa_id);


--
-- Name: idx_crm_estagio_ia_config_estagio; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_estagio_ia_config_estagio ON saas.crm_estagio_ia_config USING btree (estagio_id);


--
-- Name: idx_crm_estagio_ia_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_estagio_ia_empresa ON saas.crm_estagio_ia_config USING btree (empresa_id);


--
-- Name: idx_crm_estagio_ia_estagio; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_estagio_ia_estagio ON saas.crm_estagio_ia_config USING btree (estagio_id);


--
-- Name: idx_crm_historico_estagios_entidade; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_historico_estagios_entidade ON saas.crm_historico_estagios USING btree (entidade_tipo, entidade_id, criado_em DESC);


--
-- Name: idx_crm_negocios_dados_custom; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_dados_custom ON saas.crm_negocios USING gin (dados_custom) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_empresa_criado; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_empresa_criado ON saas.crm_negocios USING btree (empresa_id, criado_em DESC) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_empresa_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_empresa_status ON saas.crm_negocios USING btree (empresa_id, status) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_fechamento; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_fechamento ON saas.crm_negocios USING btree (empresa_id, data_fechamento_prevista) WHERE ((status = 'aberto'::saas.status_negocio) AND (deletado_em IS NULL));


--
-- Name: idx_crm_negocios_nome_trgm; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_nome_trgm ON saas.crm_negocios USING gin (nome public.gin_trgm_ops) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_numero; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_negocios_numero ON saas.crm_negocios USING btree (numero_registro);


--
-- Name: idx_crm_negocios_pipeline_estagio; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_pipeline_estagio ON saas.crm_negocios USING btree (pipeline_id, estagio_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_proprietario; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_proprietario ON saas.crm_negocios USING btree (proprietario_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_negocios_tags; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_negocios_tags ON saas.crm_negocios USING gin (tags) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_notas_entidade; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_notas_entidade ON saas.crm_notas USING btree (empresa_id, entidade_tipo, entidade_id, criado_em DESC);


--
-- Name: idx_crm_tickets_dados_custom; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_dados_custom ON saas.crm_tickets USING gin (dados_custom) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_empresa_criado; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_empresa_criado ON saas.crm_tickets USING btree (empresa_id, criado_em DESC) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_empresa_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_empresa_status ON saas.crm_tickets USING btree (empresa_id, status) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_numero; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_crm_tickets_numero ON saas.crm_tickets USING btree (numero_registro);


--
-- Name: idx_crm_tickets_pipeline_estagio; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_pipeline_estagio ON saas.crm_tickets USING btree (pipeline_id, estagio_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_prioridade; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_prioridade ON saas.crm_tickets USING btree (empresa_id, prioridade) WHERE ((status = ANY (ARRAY['aberto'::saas.status_ticket, 'em_andamento'::saas.status_ticket])) AND (deletado_em IS NULL));


--
-- Name: idx_crm_tickets_proprietario; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_proprietario ON saas.crm_tickets USING btree (proprietario_id) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_tags; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_tags ON saas.crm_tickets USING gin (tags) WHERE (deletado_em IS NULL);


--
-- Name: idx_crm_tickets_titulo_trgm; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_crm_tickets_titulo_trgm ON saas.crm_tickets USING gin (titulo public.gin_trgm_ops) WHERE (deletado_em IS NULL);


--
-- Name: idx_fila_avaliacoes_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_fila_avaliacoes_status ON saas.fila_avaliacoes USING btree (status, criado_em);


--
-- Name: idx_instancias_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_instancias_empresa ON saas.instancias_whatsapp USING btree (empresa_id);


--
-- Name: idx_logs_auditoria_empresa_data; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_logs_auditoria_empresa_data ON saas.logs_auditoria USING btree (empresa_id, criado_em DESC);


--
-- Name: idx_mensagens_conversa_data; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_mensagens_conversa_data ON saas.mensagens_whatsapp USING btree (conversa_id, enviada_em DESC);


--
-- Name: idx_notificacoes_usuario_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_notificacoes_usuario_status ON saas.notificacoes USING btree (usuario_id, status, criado_em DESC);


--
-- Name: idx_reunioes_data; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_reunioes_data ON saas.reunioes USING btree (data_reuniao DESC);


--
-- Name: idx_reunioes_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_reunioes_empresa ON saas.reunioes USING btree (empresa_id);


--
-- Name: idx_reunioes_google_event; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX idx_reunioes_google_event ON saas.reunioes USING btree (empresa_id, google_event_id) WHERE (google_event_id IS NOT NULL);


--
-- Name: idx_reunioes_sentimento; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_reunioes_sentimento ON saas.reunioes USING btree (sentimento) WHERE (sentimento IS NOT NULL);


--
-- Name: idx_reunioes_vendedor; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_reunioes_vendedor ON saas.reunioes USING btree (vendedor_id);


--
-- Name: idx_saas_meet_conferences_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_meet_conferences_empresa ON saas.meet_conferences USING btree (empresa_id);


--
-- Name: idx_saas_meet_conferences_organizer; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_meet_conferences_organizer ON saas.meet_conferences USING btree (organizer_email);


--
-- Name: idx_saas_meet_conferences_recording_source; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_meet_conferences_recording_source ON saas.meet_conferences USING btree (recording_source_file_id);


--
-- Name: idx_saas_meet_conferences_started_at; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_meet_conferences_started_at ON saas.meet_conferences USING btree (started_at DESC);


--
-- Name: idx_saas_meet_conferences_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_meet_conferences_status ON saas.meet_conferences USING btree (status);


--
-- Name: idx_saas_run_conf_logs_created; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_run_conf_logs_created ON saas.run_conference_api_logs USING btree (created_at DESC);


--
-- Name: idx_saas_run_conf_logs_key; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_saas_run_conf_logs_key ON saas.run_conference_api_logs USING btree (conference_key, created_at DESC);


--
-- Name: idx_solicitacoes_empresa_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_solicitacoes_empresa_status ON saas.solicitacoes_acesso USING btree (empresa_id, status, solicitado_em DESC);


--
-- Name: idx_ticket_owner_history_ticket; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_ticket_owner_history_ticket ON saas.crm_ticket_owner_history USING btree (ticket_id);


--
-- Name: idx_ticket_owner_history_user; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_ticket_owner_history_user ON saas.crm_ticket_owner_history USING btree (usuario_id);


--
-- Name: idx_times_area; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_times_area ON saas.times USING btree (area_id);


--
-- Name: idx_times_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_times_empresa ON saas.times USING btree (empresa_id);


--
-- Name: idx_usuarios_empresa; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_usuarios_empresa ON saas.usuarios USING btree (empresa_id);


--
-- Name: idx_usuarios_papel; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_usuarios_papel ON saas.usuarios USING btree (papel);


--
-- Name: idx_usuarios_status; Type: INDEX; Schema: saas; Owner: -
--

CREATE INDEX idx_usuarios_status ON saas.usuarios USING btree (status);


--
-- Name: ux_reunioes_empresa_google_event; Type: INDEX; Schema: saas; Owner: -
--

CREATE UNIQUE INDEX ux_reunioes_empresa_google_event ON saas.reunioes USING btree (empresa_id, google_event_id);


--
-- Name: meta_inbox_conversations trg_inbox_conversation_opened; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inbox_conversation_opened AFTER INSERT ON public.meta_inbox_conversations FOR EACH ROW EXECUTE FUNCTION public.inbox_conversation_opened_trigger();


--
-- Name: meta_inbox_messages trg_inbox_message_metrics; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inbox_message_metrics AFTER INSERT ON public.meta_inbox_messages FOR EACH ROW EXECUTE FUNCTION public.inbox_message_metrics_trigger();


--
-- Name: meta_inbox_accounts update_meta_inbox_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_meta_inbox_accounts_updated_at BEFORE UPDATE ON public.meta_inbox_accounts FOR EACH ROW EXECUTE FUNCTION public.update_meta_inbox_updated_at();


--
-- Name: meta_inbox_conversations update_meta_inbox_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_meta_inbox_conversations_updated_at BEFORE UPDATE ON public.meta_inbox_conversations FOR EACH ROW EXECUTE FUNCTION public.update_meta_inbox_updated_at();


--
-- Name: meta_inbox_metrics_daily update_meta_inbox_metrics_daily_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_meta_inbox_metrics_daily_updated_at BEFORE UPDATE ON public.meta_inbox_metrics_daily FOR EACH ROW EXECUTE FUNCTION public.update_meta_inbox_updated_at();


--
-- Name: reunioes trg_alertar_sem_transcricao; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_alertar_sem_transcricao AFTER INSERT OR UPDATE OF status ON saas.reunioes FOR EACH ROW EXECUTE FUNCTION saas.alertar_reuniao_sem_transcricao();


--
-- Name: analises_ia trg_analises_ia_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_analises_ia_atualizado_em BEFORE UPDATE ON saas.analises_ia FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: areas trg_areas_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_areas_atualizado_em BEFORE UPDATE ON saas.areas FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: automacoes_webhooks trg_automacoes_webhooks_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_automacoes_webhooks_atualizado_em BEFORE UPDATE ON saas.automacoes_webhooks FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: avaliacoes_reunioes trg_avaliacoes_reunioes_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_avaliacoes_reunioes_atualizado_em BEFORE UPDATE ON saas.avaliacoes_reunioes FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: configuracoes_modulos_empresa trg_cfg_modulos_empresa_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_cfg_modulos_empresa_atualizado_em BEFORE UPDATE ON saas.configuracoes_modulos_empresa FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: configuracoes_modulos_usuario trg_cfg_modulos_usuario_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_cfg_modulos_usuario_atualizado_em BEFORE UPDATE ON saas.configuracoes_modulos_usuario FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: conversas_whatsapp trg_conversas_whatsapp_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_conversas_whatsapp_atualizado_em BEFORE UPDATE ON saas.conversas_whatsapp FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_ai_conversations trg_crm_ai_conv_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_ai_conv_atualizado_em BEFORE UPDATE ON saas.crm_ai_conversations FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_atividades trg_crm_atividades_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_atividades_atualizado_em BEFORE UPDATE ON saas.crm_atividades FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_contatos trg_crm_contatos_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_contatos_atualizado_em BEFORE UPDATE ON saas.crm_contatos FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_contatos trg_crm_contatos_numero_registro; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_contatos_numero_registro BEFORE INSERT ON saas.crm_contatos FOR EACH ROW EXECUTE FUNCTION saas.definir_numero_registro();


--
-- Name: crm_empresas trg_crm_empresas_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_empresas_atualizado_em BEFORE UPDATE ON saas.crm_empresas FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_empresas trg_crm_empresas_numero_registro; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_empresas_numero_registro BEFORE INSERT ON saas.crm_empresas FOR EACH ROW EXECUTE FUNCTION saas.definir_numero_registro();


--
-- Name: crm_estagio_ia_config trg_crm_estagio_ia_config_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_estagio_ia_config_atualizado_em BEFORE UPDATE ON saas.crm_estagio_ia_config FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_negocios trg_crm_negocios_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_negocios_atualizado_em BEFORE UPDATE ON saas.crm_negocios FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_negocios trg_crm_negocios_numero_registro; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_negocios_numero_registro BEFORE INSERT ON saas.crm_negocios FOR EACH ROW EXECUTE FUNCTION saas.definir_numero_registro();


--
-- Name: crm_notas trg_crm_notas_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_notas_atualizado_em BEFORE UPDATE ON saas.crm_notas FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_pipeline_estagios trg_crm_pipeline_estagios_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_pipeline_estagios_atualizado_em BEFORE UPDATE ON saas.crm_pipeline_estagios FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_pipelines trg_crm_pipelines_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_pipelines_atualizado_em BEFORE UPDATE ON saas.crm_pipelines FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_tickets trg_crm_tickets_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_tickets_atualizado_em BEFORE UPDATE ON saas.crm_tickets FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_tickets trg_crm_tickets_numero_registro; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_crm_tickets_numero_registro BEFORE INSERT ON saas.crm_tickets FOR EACH ROW EXECUTE FUNCTION saas.definir_numero_registro();


--
-- Name: empresas trg_empresas_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_empresas_atualizado_em BEFORE UPDATE ON saas.empresas FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: reunioes trg_enfileirar_avaliacao; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_enfileirar_avaliacao AFTER UPDATE OF transcricao ON saas.reunioes FOR EACH ROW EXECUTE FUNCTION saas.enfileirar_avaliacao_reuniao();


--
-- Name: crm_pipeline_estagios trg_estagio_nome_interno; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_estagio_nome_interno BEFORE INSERT ON saas.crm_pipeline_estagios FOR EACH ROW WHEN ((new.nome_interno IS NULL)) EXECUTE FUNCTION saas.gerar_nome_interno();


--
-- Name: crm_negocios trg_historico_estagio_insert_negocio; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_historico_estagio_insert_negocio AFTER INSERT ON saas.crm_negocios FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_insert_negocio();


--
-- Name: crm_tickets trg_historico_estagio_insert_ticket; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_historico_estagio_insert_ticket AFTER INSERT ON saas.crm_tickets FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_insert_ticket();


--
-- Name: crm_negocios trg_historico_estagio_negocio; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_historico_estagio_negocio AFTER UPDATE OF estagio_id ON saas.crm_negocios FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_negocio();


--
-- Name: crm_tickets trg_historico_estagio_ticket; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_historico_estagio_ticket AFTER UPDATE OF estagio_id ON saas.crm_tickets FOR EACH ROW EXECUTE FUNCTION saas.registrar_historico_estagio_ticket();


--
-- Name: instancias_whatsapp trg_instancias_whatsapp_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_instancias_whatsapp_atualizado_em BEFORE UPDATE ON saas.instancias_whatsapp FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: integracoes trg_integracoes_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_integracoes_atualizado_em BEFORE UPDATE ON saas.integracoes FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: modulos_sistema trg_modulos_sistema_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_modulos_sistema_atualizado_em BEFORE UPDATE ON saas.modulos_sistema FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: permissoes_papeis trg_permissoes_papeis_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_permissoes_papeis_atualizado_em BEFORE UPDATE ON saas.permissoes_papeis FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: crm_pipelines trg_pipeline_nome_interno; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_pipeline_nome_interno BEFORE INSERT ON saas.crm_pipelines FOR EACH ROW WHEN ((new.nome_interno IS NULL)) EXECUTE FUNCTION saas.gerar_nome_interno();


--
-- Name: reunioes trg_reunioes_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_reunioes_atualizado_em BEFORE UPDATE ON saas.reunioes FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: meet_conferences trg_sync_gravacao_reuniao_from_meet_conference; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_sync_gravacao_reuniao_from_meet_conference AFTER INSERT OR UPDATE ON saas.meet_conferences FOR EACH ROW EXECUTE FUNCTION saas.trg_sync_gravacao_reuniao_from_meet_conference();


--
-- Name: meet_conferences trg_sync_reuniao_from_meet_conference; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_sync_reuniao_from_meet_conference AFTER INSERT OR UPDATE ON saas.meet_conferences FOR EACH ROW EXECUTE FUNCTION saas.trg_sync_reuniao_from_meet_conference();


--
-- Name: times trg_times_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_times_atualizado_em BEFORE UPDATE ON saas.times FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: tokens_ia_modulo trg_tokens_ia_modulo_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_tokens_ia_modulo_atualizado_em BEFORE UPDATE ON saas.tokens_ia_modulo FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: usuarios trg_usuarios_atualizado_em; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_usuarios_atualizado_em BEFORE UPDATE ON saas.usuarios FOR EACH ROW EXECUTE FUNCTION saas.definir_atualizado_em();


--
-- Name: tokens_ia_modulo trg_validate_openai_token; Type: TRIGGER; Schema: saas; Owner: -
--

CREATE TRIGGER trg_validate_openai_token BEFORE INSERT OR UPDATE ON saas.tokens_ia_modulo FOR EACH ROW EXECUTE FUNCTION saas.validate_openai_token();


--
-- Name: meta_bulk_send_logs meta_bulk_send_logs_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_bulk_send_logs
    ADD CONSTRAINT meta_bulk_send_logs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_accounts meta_inbox_accounts_ticket_estagio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_accounts
    ADD CONSTRAINT meta_inbox_accounts_ticket_estagio_id_fkey FOREIGN KEY (ticket_estagio_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: meta_inbox_accounts meta_inbox_accounts_ticket_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_accounts
    ADD CONSTRAINT meta_inbox_accounts_ticket_pipeline_id_fkey FOREIGN KEY (ticket_pipeline_id) REFERENCES saas.crm_pipelines(id) ON DELETE SET NULL;


--
-- Name: meta_inbox_conversations meta_inbox_conversations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_conversations
    ADD CONSTRAINT meta_inbox_conversations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_macros meta_inbox_macros_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_macros
    ADD CONSTRAINT meta_inbox_macros_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_messages meta_inbox_messages_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_messages
    ADD CONSTRAINT meta_inbox_messages_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_messages meta_inbox_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_messages
    ADD CONSTRAINT meta_inbox_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.meta_inbox_conversations(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_messages meta_inbox_messages_sent_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_messages
    ADD CONSTRAINT meta_inbox_messages_sent_by_user_id_fkey FOREIGN KEY (sent_by_user_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: meta_inbox_metrics_daily meta_inbox_metrics_daily_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_metrics_daily
    ADD CONSTRAINT meta_inbox_metrics_daily_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_tags meta_inbox_tags_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_tags
    ADD CONSTRAINT meta_inbox_tags_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_templates meta_inbox_templates_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_templates
    ADD CONSTRAINT meta_inbox_templates_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: meta_inbox_user_access meta_inbox_user_access_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox_user_access
    ADD CONSTRAINT meta_inbox_user_access_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.meta_inbox_accounts(id) ON DELETE CASCADE;


--
-- Name: agente_arquivos agente_arquivos_agente_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agente_arquivos
    ADD CONSTRAINT agente_arquivos_agente_id_fkey FOREIGN KEY (agente_id) REFERENCES saas.agentes_ia(id) ON DELETE CASCADE;


--
-- Name: agente_arquivos agente_arquivos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agente_arquivos
    ADD CONSTRAINT agente_arquivos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: agentes_ia agentes_ia_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agentes_ia
    ADD CONSTRAINT agentes_ia_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: agentes_ia agentes_ia_parent_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.agentes_ia
    ADD CONSTRAINT agentes_ia_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES saas.agentes_ia(id) ON DELETE CASCADE;


--
-- Name: analises_ia analises_ia_agente_avaliador_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.analises_ia
    ADD CONSTRAINT analises_ia_agente_avaliador_id_fkey FOREIGN KEY (agente_avaliador_id) REFERENCES saas.agentes_ia(id);


--
-- Name: analises_ia analises_ia_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.analises_ia
    ADD CONSTRAINT analises_ia_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: analises_ia analises_ia_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.analises_ia
    ADD CONSTRAINT analises_ia_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: areas areas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.areas
    ADD CONSTRAINT areas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: automacoes_webhooks automacoes_webhooks_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.automacoes_webhooks
    ADD CONSTRAINT automacoes_webhooks_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: avaliacoes_reunioes avaliacoes_reunioes_avaliador_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.avaliacoes_reunioes
    ADD CONSTRAINT avaliacoes_reunioes_avaliador_id_fkey FOREIGN KEY (avaliador_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: avaliacoes_reunioes avaliacoes_reunioes_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.avaliacoes_reunioes
    ADD CONSTRAINT avaliacoes_reunioes_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES saas.reunioes(id) ON DELETE CASCADE;


--
-- Name: comentarios_reuniao comentarios_reuniao_autor_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.comentarios_reuniao
    ADD CONSTRAINT comentarios_reuniao_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: comentarios_reuniao comentarios_reuniao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.comentarios_reuniao
    ADD CONSTRAINT comentarios_reuniao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: comentarios_reuniao comentarios_reuniao_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.comentarios_reuniao
    ADD CONSTRAINT comentarios_reuniao_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES saas.reunioes(id) ON DELETE CASCADE;


--
-- Name: configuracoes_ia configuracoes_ia_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_ia
    ADD CONSTRAINT configuracoes_ia_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: configuracoes_modulos_empresa configuracoes_modulos_empresa_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_empresa
    ADD CONSTRAINT configuracoes_modulos_empresa_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: configuracoes_modulos_empresa configuracoes_modulos_empresa_modulo_codigo_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_empresa
    ADD CONSTRAINT configuracoes_modulos_empresa_modulo_codigo_fkey FOREIGN KEY (modulo_codigo) REFERENCES saas.modulos_sistema(codigo) ON DELETE CASCADE;


--
-- Name: configuracoes_modulos_usuario configuracoes_modulos_usuario_modulo_codigo_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_usuario
    ADD CONSTRAINT configuracoes_modulos_usuario_modulo_codigo_fkey FOREIGN KEY (modulo_codigo) REFERENCES saas.modulos_sistema(codigo) ON DELETE CASCADE;


--
-- Name: configuracoes_modulos_usuario configuracoes_modulos_usuario_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.configuracoes_modulos_usuario
    ADD CONSTRAINT configuracoes_modulos_usuario_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE CASCADE;


--
-- Name: conversas_whatsapp conversas_whatsapp_instancia_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.conversas_whatsapp
    ADD CONSTRAINT conversas_whatsapp_instancia_id_fkey FOREIGN KEY (instancia_id) REFERENCES saas.instancias_whatsapp(id) ON DELETE CASCADE;


--
-- Name: conversas_whatsapp conversas_whatsapp_responsavel_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.conversas_whatsapp
    ADD CONSTRAINT conversas_whatsapp_responsavel_usuario_id_fkey FOREIGN KEY (responsavel_usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_ai_conversations crm_ai_conversations_contato_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ai_conversations
    ADD CONSTRAINT crm_ai_conversations_contato_id_fkey FOREIGN KEY (contato_id) REFERENCES saas.crm_contatos(id) ON DELETE SET NULL;


--
-- Name: crm_ai_conversations crm_ai_conversations_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ai_conversations
    ADD CONSTRAINT crm_ai_conversations_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_ai_conversations crm_ai_conversations_estagio_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ai_conversations
    ADD CONSTRAINT crm_ai_conversations_estagio_id_fkey FOREIGN KEY (estagio_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: crm_associacoes crm_associacoes_criado_por_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_associacoes
    ADD CONSTRAINT crm_associacoes_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_associacoes crm_associacoes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_associacoes
    ADD CONSTRAINT crm_associacoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_atividades crm_atividades_atribuido_para_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_atividades
    ADD CONSTRAINT crm_atividades_atribuido_para_fkey FOREIGN KEY (atribuido_para) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_atividades crm_atividades_criado_por_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_atividades
    ADD CONSTRAINT crm_atividades_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_atividades crm_atividades_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_atividades
    ADD CONSTRAINT crm_atividades_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_contatos crm_contatos_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_contatos
    ADD CONSTRAINT crm_contatos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_contatos crm_contatos_proprietario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_contatos
    ADD CONSTRAINT crm_contatos_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_empresas crm_empresas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_empresas
    ADD CONSTRAINT crm_empresas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_empresas crm_empresas_empresa_pai_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_empresas
    ADD CONSTRAINT crm_empresas_empresa_pai_id_fkey FOREIGN KEY (empresa_pai_id) REFERENCES saas.crm_empresas(id) ON DELETE SET NULL;


--
-- Name: crm_empresas crm_empresas_proprietario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_empresas
    ADD CONSTRAINT crm_empresas_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_estagio_ia_config crm_estagio_ia_config_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_estagio_ia_config
    ADD CONSTRAINT crm_estagio_ia_config_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_estagio_ia_config crm_estagio_ia_config_estagio_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_estagio_ia_config
    ADD CONSTRAINT crm_estagio_ia_config_estagio_id_fkey FOREIGN KEY (estagio_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE CASCADE;


--
-- Name: crm_historico_estagios crm_historico_estagios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_historico_estagios
    ADD CONSTRAINT crm_historico_estagios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_historico_estagios crm_historico_estagios_estagio_anterior_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_historico_estagios
    ADD CONSTRAINT crm_historico_estagios_estagio_anterior_id_fkey FOREIGN KEY (estagio_anterior_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: crm_historico_estagios crm_historico_estagios_estagio_novo_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_historico_estagios
    ADD CONSTRAINT crm_historico_estagios_estagio_novo_id_fkey FOREIGN KEY (estagio_novo_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: crm_historico_estagios crm_historico_estagios_realizado_por_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_historico_estagios
    ADD CONSTRAINT crm_historico_estagios_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_negocios crm_negocios_contato_principal_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_contato_principal_id_fkey FOREIGN KEY (contato_principal_id) REFERENCES saas.crm_contatos(id) ON DELETE SET NULL;


--
-- Name: crm_negocios crm_negocios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_negocios crm_negocios_estagio_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_estagio_id_fkey FOREIGN KEY (estagio_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: crm_negocios crm_negocios_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES saas.crm_pipelines(id) ON DELETE SET NULL;


--
-- Name: crm_negocios crm_negocios_proprietario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_negocios
    ADD CONSTRAINT crm_negocios_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_notas crm_notas_criado_por_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_notas
    ADD CONSTRAINT crm_notas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_notas crm_notas_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_notas
    ADD CONSTRAINT crm_notas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_pipeline_estagios crm_pipeline_estagios_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipeline_estagios
    ADD CONSTRAINT crm_pipeline_estagios_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES saas.crm_pipelines(id) ON DELETE CASCADE;


--
-- Name: crm_pipelines crm_pipelines_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_pipelines
    ADD CONSTRAINT crm_pipelines_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_ticket_owner_history crm_ticket_owner_history_atribuido_por_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ticket_owner_history
    ADD CONSTRAINT crm_ticket_owner_history_atribuido_por_fkey FOREIGN KEY (atribuido_por) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_ticket_owner_history crm_ticket_owner_history_ticket_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ticket_owner_history
    ADD CONSTRAINT crm_ticket_owner_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES saas.crm_tickets(id) ON DELETE CASCADE;


--
-- Name: crm_ticket_owner_history crm_ticket_owner_history_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_ticket_owner_history
    ADD CONSTRAINT crm_ticket_owner_history_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: crm_tickets crm_tickets_contato_principal_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_contato_principal_id_fkey FOREIGN KEY (contato_principal_id) REFERENCES saas.crm_contatos(id) ON DELETE SET NULL;


--
-- Name: crm_tickets crm_tickets_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: crm_tickets crm_tickets_estagio_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_estagio_id_fkey FOREIGN KEY (estagio_id) REFERENCES saas.crm_pipeline_estagios(id) ON DELETE SET NULL;


--
-- Name: crm_tickets crm_tickets_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES saas.crm_pipelines(id) ON DELETE SET NULL;


--
-- Name: crm_tickets crm_tickets_proprietario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.crm_tickets
    ADD CONSTRAINT crm_tickets_proprietario_id_fkey FOREIGN KEY (proprietario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: eventos_webhooks eventos_webhooks_automacao_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.eventos_webhooks
    ADD CONSTRAINT eventos_webhooks_automacao_id_fkey FOREIGN KEY (automacao_id) REFERENCES saas.automacoes_webhooks(id) ON DELETE SET NULL;


--
-- Name: eventos_webhooks eventos_webhooks_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.eventos_webhooks
    ADD CONSTRAINT eventos_webhooks_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: fila_avaliacoes fila_avaliacoes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.fila_avaliacoes
    ADD CONSTRAINT fila_avaliacoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: fila_avaliacoes fila_avaliacoes_reuniao_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.fila_avaliacoes
    ADD CONSTRAINT fila_avaliacoes_reuniao_id_fkey FOREIGN KEY (reuniao_id) REFERENCES saas.reunioes(id) ON DELETE CASCADE;


--
-- Name: areas fk_areas_gerente; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.areas
    ADD CONSTRAINT fk_areas_gerente FOREIGN KEY (gerente_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: times fk_times_supervisor; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.times
    ADD CONSTRAINT fk_times_supervisor FOREIGN KEY (supervisor_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: instancias_whatsapp instancias_whatsapp_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.instancias_whatsapp
    ADD CONSTRAINT instancias_whatsapp_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: instancias_whatsapp instancias_whatsapp_time_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.instancias_whatsapp
    ADD CONSTRAINT instancias_whatsapp_time_id_fkey FOREIGN KEY (time_id) REFERENCES saas.times(id) ON DELETE SET NULL;


--
-- Name: instancias_whatsapp instancias_whatsapp_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.instancias_whatsapp
    ADD CONSTRAINT instancias_whatsapp_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: integracoes integracoes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.integracoes
    ADD CONSTRAINT integracoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: integracoes integracoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.integracoes
    ADD CONSTRAINT integracoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: logs_auditoria logs_auditoria_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.logs_auditoria
    ADD CONSTRAINT logs_auditoria_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: logs_auditoria logs_auditoria_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.logs_auditoria
    ADD CONSTRAINT logs_auditoria_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: meet_conferences meet_conferences_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.meet_conferences
    ADD CONSTRAINT meet_conferences_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE SET NULL;


--
-- Name: mensagens_whatsapp mensagens_whatsapp_conversa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_conversa_id_fkey FOREIGN KEY (conversa_id) REFERENCES saas.conversas_whatsapp(id) ON DELETE CASCADE;


--
-- Name: mensagens_whatsapp mensagens_whatsapp_instancia_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.mensagens_whatsapp
    ADD CONSTRAINT mensagens_whatsapp_instancia_id_fkey FOREIGN KEY (instancia_id) REFERENCES saas.instancias_whatsapp(id) ON DELETE CASCADE;


--
-- Name: notificacoes notificacoes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.notificacoes
    ADD CONSTRAINT notificacoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: notificacoes notificacoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES saas.usuarios(id) ON DELETE CASCADE;


--
-- Name: reunioes reunioes_area_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.reunioes
    ADD CONSTRAINT reunioes_area_id_fkey FOREIGN KEY (area_id) REFERENCES saas.areas(id) ON DELETE SET NULL;


--
-- Name: reunioes reunioes_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.reunioes
    ADD CONSTRAINT reunioes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: reunioes reunioes_time_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.reunioes
    ADD CONSTRAINT reunioes_time_id_fkey FOREIGN KEY (time_id) REFERENCES saas.times(id) ON DELETE SET NULL;


--
-- Name: reunioes reunioes_vendedor_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.reunioes
    ADD CONSTRAINT reunioes_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: solicitacoes_acesso solicitacoes_acesso_decidido_por_usuario_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.solicitacoes_acesso
    ADD CONSTRAINT solicitacoes_acesso_decidido_por_usuario_id_fkey FOREIGN KEY (decidido_por_usuario_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: solicitacoes_acesso solicitacoes_acesso_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.solicitacoes_acesso
    ADD CONSTRAINT solicitacoes_acesso_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: times times_area_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.times
    ADD CONSTRAINT times_area_id_fkey FOREIGN KEY (area_id) REFERENCES saas.areas(id) ON DELETE SET NULL;


--
-- Name: times times_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.times
    ADD CONSTRAINT times_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: tokens_ia_modulo tokens_ia_modulo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.tokens_ia_modulo
    ADD CONSTRAINT tokens_ia_modulo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: tokens_ia_modulo tokens_ia_modulo_modulo_codigo_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.tokens_ia_modulo
    ADD CONSTRAINT tokens_ia_modulo_modulo_codigo_fkey FOREIGN KEY (modulo_codigo) REFERENCES saas.modulos_sistema(codigo) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_area_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_area_id_fkey FOREIGN KEY (area_id) REFERENCES saas.areas(id) ON DELETE SET NULL;


--
-- Name: usuarios usuarios_empresa_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES saas.empresas(id) ON DELETE CASCADE;


--
-- Name: usuarios usuarios_time_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.usuarios
    ADD CONSTRAINT usuarios_time_id_fkey FOREIGN KEY (time_id) REFERENCES saas.times(id) ON DELETE SET NULL;


--
-- Name: whatsapp_chat_settings whatsapp_chat_settings_responsavel_id_fkey; Type: FK CONSTRAINT; Schema: saas; Owner: -
--

ALTER TABLE ONLY saas.whatsapp_chat_settings
    ADD CONSTRAINT whatsapp_chat_settings_responsavel_id_fkey FOREIGN KEY (responsavel_id) REFERENCES saas.usuarios(id) ON DELETE SET NULL;


--
-- Name: meta_inbox_macros macros_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY macros_all ON public.meta_inbox_macros USING (true) WITH CHECK (true);


--
-- Name: meta_bulk_send_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_bulk_send_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_bulk_send_logs meta_bulk_send_logs_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_bulk_send_logs_all ON public.meta_bulk_send_logs USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_accounts meta_inbox_accounts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_accounts_delete ON public.meta_inbox_accounts FOR DELETE USING (true);


--
-- Name: meta_inbox_accounts meta_inbox_accounts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_accounts_insert ON public.meta_inbox_accounts FOR INSERT WITH CHECK (true);


--
-- Name: meta_inbox_accounts meta_inbox_accounts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_accounts_select ON public.meta_inbox_accounts FOR SELECT USING (true);


--
-- Name: meta_inbox_accounts meta_inbox_accounts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_accounts_update ON public.meta_inbox_accounts FOR UPDATE USING (true);


--
-- Name: meta_inbox_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_conversations meta_inbox_conversations_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_conversations_all ON public.meta_inbox_conversations USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_macros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_macros ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_messages meta_inbox_messages_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_messages_all ON public.meta_inbox_messages USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_metrics_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_metrics_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_metrics_daily meta_inbox_metrics_daily_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_metrics_daily_all ON public.meta_inbox_metrics_daily USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_templates meta_inbox_templates_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_templates_all ON public.meta_inbox_templates USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_user_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox_user_access ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox_user_access meta_inbox_user_access_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_user_access_all ON public.meta_inbox_user_access USING (true) WITH CHECK (true);


--
-- Name: meta_inbox_tags tags_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_all ON public.meta_inbox_tags USING (true) WITH CHECK (true);


--
-- Name: agente_arquivos; Type: ROW SECURITY; Schema: saas; Owner: -
--

ALTER TABLE saas.agente_arquivos ENABLE ROW LEVEL SECURITY;

--
-- Name: agente_arquivos agente_arquivos_all; Type: POLICY; Schema: saas; Owner: -
--

CREATE POLICY agente_arquivos_all ON saas.agente_arquivos USING (true) WITH CHECK (true);


--
-- Name: agentes_ia; Type: ROW SECURITY; Schema: saas; Owner: -
--

ALTER TABLE saas.agentes_ia ENABLE ROW LEVEL SECURITY;

--
-- Name: agentes_ia agentes_ia_all; Type: POLICY; Schema: saas; Owner: -
--

CREATE POLICY agentes_ia_all ON saas.agentes_ia USING (true) WITH CHECK (true);


--
-- Name: whatsapp_chat_settings chat_settings_all; Type: POLICY; Schema: saas; Owner: -
--

CREATE POLICY chat_settings_all ON saas.whatsapp_chat_settings USING (true) WITH CHECK (true);


--
-- Name: fila_avaliacoes; Type: ROW SECURITY; Schema: saas; Owner: -
--

ALTER TABLE saas.fila_avaliacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: fila_avaliacoes fila_avaliacoes_all; Type: POLICY; Schema: saas; Owner: -
--

CREATE POLICY fila_avaliacoes_all ON saas.fila_avaliacoes USING (true) WITH CHECK (true);


--
-- Name: whatsapp_chat_settings; Type: ROW SECURITY; Schema: saas; Owner: -
--

ALTER TABLE saas.whatsapp_chat_settings ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 1Dd1Nq0HAMJaP3ofJPwLUDGQD2cryHNVUy6GzB8lUujhh3qTrpEYCVkHvo7QmhT

