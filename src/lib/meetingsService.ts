/**
 * Service for loading and syncing meetings from the database.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId, normalizeEmail } from '@/lib/saas';
import { autoCreateAppmaxUser } from '@/lib/accessControl';

export interface DbMeeting {
  id: string;
  titulo: string;
  data_reuniao: string;
  duracao_minutos: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  link_meet: string | null;
  status: string;
  score: number | null;
  analisada_por_ia: boolean;
  participantes: { email: string; name?: string }[];
  transcricao: string | null;
  vendedor_id?: string | null;
  vendedor_nome?: string;
  vendedor_email?: string;
  area_id?: string | null;
  time_id?: string | null;
  google_event_id?: string;
  transcript_file_id?: string | null;
  sentimento?: string | null;
  meeting_code?: string | null;
  auditoria_manual?: boolean;
}

export interface TranscriptInfo {
  transcript_source_file_id?: string;
  transcript_copied_file_id?: string;
  transcript_text?: string;
  meeting_code?: string;
  status?: string;
}

interface CollectorTranscriptResult {
  transcript_text: string;
  transcript_copied_file_id: string | null;
}

async function postCollector(action: 'run-conference' | 'transcript', body: Record<string, string>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('meet-gateway', {
    body: {
      action,
      ...body,
    },
  });

  if (error) {
    throw new Error(`Meet gateway error: ${error.message}`);
  }

  if (data?.ok === false) {
    throw new Error(data?.error || 'Erro no meet-gateway');
  }

  return data;
}

async function getTranscriptFromCollector(conferenceKey: string): Promise<CollectorTranscriptResult | null> {
  const payload = await postCollector('transcript', { conference_key: conferenceKey });
  const result = payload?.result || payload;

  const transcriptText = String(result?.transcript_text || '').trim();
  const fileId = result?.transcript_copied_file_id || null;

  if (!transcriptText || transcriptText.length < 10) return null;

  return {
    transcript_text: transcriptText,
    transcript_copied_file_id: fileId,
  };
}


/**
 * Step 1: Sync appmax.meet_conferences → saas.reunioes via RPC
 */
export async function syncMeetConferences(): Promise<{ inserted: number; updated: number }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .rpc('sincronizar_reunioes', { p_empresa_id: empresaId });

  if (error) throw new Error(`Sync error: ${error.message}`);
  return data || { inserted: 0, updated: 0 };
}

/**
 * Trigger conference-by-conference transcription fetch using meet-gateway.
 */
export async function triggerTranscriptionFetch(): Promise<{ queued: number; ok: number; fail: number }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('google_event_id')
    .eq('empresa_id', empresaId)
    .is('transcricao', null)
    .not('google_event_id', 'is', null);

  if (error) throw new Error(`Failed to list pending meetings: ${error.message}`);

  const conferenceKeys = [...new Set((data || []).map((r: any) => String(r.google_event_id || '').trim()).filter(Boolean))];
  if (conferenceKeys.length === 0) return { queued: 0, ok: 0, fail: 0 };

  let ok = 0;
  let fail = 0;

  for (const conferenceKey of conferenceKeys) {
    try {
      await postCollector('run-conference', { conference_key: conferenceKey });
      ok += 1;
    } catch (err) {
      console.warn(`[meetings] run-conference failed for ${conferenceKey}:`, err);
      fail += 1;
    }
  }

  return { queued: conferenceKeys.length, ok, fail };
}

/**
 * Clear all meetings and related AI analyses for the current empresa.
 * Used before a full re-import.
 */
export async function clearAllMeetings(): Promise<void> {
  const empresaId = await getSaasEmpresaId();

  // Delete AI analyses for meetings first (FK dependency)
  await (supabase as any)
    .schema('saas')
    .from('analises_ia')
    .delete()
    .eq('empresa_id', empresaId)
    .eq('tipo_contexto', 'reuniao');

  // Delete all meetings
  const { error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .delete()
    .eq('empresa_id', empresaId);

  if (error) throw new Error(`Clear meetings error: ${error.message}`);
}

/**
 * Fetch transcript info from appmax.meet_conferences via RPC.
 */
export async function fetchTranscriptInfo(conferenceKey: string): Promise<TranscriptInfo> {
  const { data } = await (supabase as any)
    .schema('saas')
    .rpc('buscar_transcript_file', { p_conference_key: conferenceKey });
  return (data as TranscriptInfo) || {};
}

/**
 * Dispatch transcription POSTs via pg_net (server-side, no CORS).
 * Calls the RPC disparar_transcricoes which loops through all conferences
 * without transcript_copied_file_id and fires HTTP POSTs from the database.
 */
export async function dispararTranscricoes(): Promise<{ dispatched: number; skipped: number; keys: string[] }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .rpc('disparar_transcricoes', { p_empresa_id: empresaId });

  if (error) {
    console.error('[meetings] disparar_transcricoes error:', error);
    throw new Error(`Erro ao disparar transcrições: ${error.message}`);
  }

  console.log('[meetings] disparar_transcricoes result:', data);
  return {
    dispatched: data?.dispatched || 0,
    skipped: data?.skipped || 0,
    keys: data?.keys || [],
  };
}

/**
 * Step 3: Pull transcript_text from appmax.meet_conferences into saas.reunioes.
 * The transcription text is populated by the external service (Cloudflare worker)
 * that reads Google Docs and saves the content into meet_conferences.transcript_text.
 */
/**
 * Pull transcriptions from appmax.meet_conferences → saas.reunioes via server-side RPC.
 * Looks for meetings where status=TRANSCRIPT_DONE in meet_conferences and copies
 * transcript_text + transcript_copied_file_id into reunioes.
 */
export async function pullTranscriptions(): Promise<{ updated: number; pending: number; total: number }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .rpc('pull_transcricoes', { p_empresa_id: empresaId });

  if (error) {
    console.error('[meetings] pull_transcricoes error:', error);
    // Fallback to old N+1 approach if RPC doesn't exist yet
    return await pullTranscriptionsFallback(empresaId);
  }

  console.log('[meetings] pull_transcricoes result:', data);
  return {
    updated: data?.updated || 0,
    pending: data?.pending || 0,
    total: data?.total || 0,
  };
}

/** Fallback for when the RPC hasn't been deployed yet */
async function pullTranscriptionsFallback(empresaId: string): Promise<{ updated: number; pending: number; total: number }> {
  const { data: meetings } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('id, google_event_id, transcricao')
    .eq('empresa_id', empresaId)
    .is('transcricao', null);

  if (!meetings || meetings.length === 0) return { updated: 0, pending: 0, total: 0 };

  let updated = 0;
  let pending = 0;
  for (const m of meetings) {
    if (!m.google_event_id) continue;

    const { data: fileData } = await (supabase as any)
      .schema('saas')
      .rpc('buscar_transcript_file', { p_conference_key: m.google_event_id });

    const status = fileData?.status;
    const transcriptText = fileData?.transcript_text;
    const fileId = fileData?.transcript_copied_file_id;

    if (status === 'TRANSCRIPT_DONE' || (fileId && fileId.length > 0)) {
      const text = (transcriptText && transcriptText.trim().length > 10)
        ? transcriptText
        : `[Transcrição no Drive: ${fileId}]`;
      try {
        await (supabase as any)
          .schema('saas')
          .from('reunioes')
          .update({ transcricao: text, transcript_file_id: fileId || null })
          .eq('id', m.id);
        updated++;
      } catch (err) {
        console.warn(`[meetings] Failed to save transcript for ${m.id}:`, err);
      }
    } else if (status === 'NEW' || !status) {
      pending++;
    }
  }

  return { updated, pending, total: meetings.length };
}

/**
 * Fetch actual transcript content from Google Drive via Edge Function.
 * Reads Google Docs using the service account and stores the text in reunioes.
 */
export async function fetchTranscriptsFromDrive(): Promise<{ fetched: number; errors: number; total: number }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await supabase.functions.invoke('fetch-transcripts', {
    body: { empresa_id: empresaId },
  });

  if (error) {
    console.error('[meetings] fetch-transcripts error:', error);
    throw new Error(`Erro ao buscar transcrições do Drive: ${error.message}`);
  }

  console.log('[meetings] fetch-transcripts result:', data);
  return {
    fetched: data?.fetched || 0,
    errors: data?.errors || 0,
    total: data?.total || 0,
  };
}

export async function resolveMeetingTranscript(
  meetingId: string,
  conferenceKey: string,
): Promise<{ transcricao: string; transcript_file_id: string | null } | null> {
  const transcript = await getTranscriptFromCollector(conferenceKey);
  if (!transcript) return null;

  const { error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .update({
      transcricao: transcript.transcript_text,
      transcript_file_id: transcript.transcript_copied_file_id,
    })
    .eq('id', meetingId);

  if (error) {
    throw new Error(`Failed to persist transcript: ${error.message}`);
  }

  return {
    transcricao: transcript.transcript_text,
    transcript_file_id: transcript.transcript_copied_file_id,
  };
}

export async function loadMeetingsFromDb(): Promise<DbMeeting[]> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('data_reuniao', { ascending: false });

  if (error) {
    console.error('Failed to load meetings:', error);
    return [];
  }

  const googleEventIds = [...new Set((data || []).map((r: any) => r.google_event_id).filter(Boolean))];
  let internalConferenceKeys = new Set<string>();

  if (googleEventIds.length > 0) {
    const { data: internalRows, error: internalError } = await (supabase as any)
      .schema('saas')
      .from('meet_conferences')
      .select('conference_key')
      .in('conference_key', googleEventIds)
      .eq('call_interna', true);

    if (internalError) {
      console.warn('Failed to load internal conference keys:', internalError);
    } else {
      internalConferenceKeys = new Set((internalRows || []).map((r: any) => String(r.conference_key)));
    }
  }

  const filteredRows = (data || []).filter((row: any) => {
    if (!row.google_event_id) return true;
    return !internalConferenceKeys.has(String(row.google_event_id));
  });

  // Resolve vendedor_id → name/email
  const vendedorIds = [...new Set(filteredRows.map((r: any) => r.vendedor_id).filter(Boolean))];
  let vendedorMap: Record<string, { nome: string; email: string }> = {};

  if (vendedorIds.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id,nome,email')
      .in('id', vendedorIds);

    for (const u of users || []) {
      vendedorMap[u.id] = { nome: u.nome, email: u.email };
    }
  }

  // Update durations from transcription in background
  const toUpdateDuration: { id: string; minutos: number }[] = [];

  const mapped = filteredRows.map((r: any) => {
    let duracao = r.duracao_minutos || 0;

    // ALWAYS extract duration from transcription (more accurate than calendar estimate)
    if (r.transcricao) {
      const match = r.transcricao.match(/terminou depois de (\d{1,2}):(\d{2}):(\d{2})/i);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseInt(match[3], 10);
        const fromTranscript = Math.round(h * 60 + m + s / 60) || 1;
        if (fromTranscript !== duracao) {
          duracao = fromTranscript;
          toUpdateDuration.push({ id: r.id, minutos: duracao });
        }
      }
    }

    return {
    id: r.id,
    titulo: r.titulo || '',
    data_reuniao: r.data_reuniao,
    duracao_minutos: duracao,
    cliente_nome: r.cliente_nome,
    cliente_email: r.cliente_email,
    link_meet: r.link_meet,
    status: r.status || 'agendada',
    score: r.score,
    analisada_por_ia: r.analisada_por_ia || false,
    participantes: Array.isArray(r.participantes) ? r.participantes : [],
    transcricao: r.transcricao || null,
    vendedor_id: r.vendedor_id || null,
    vendedor_nome: vendedorMap[r.vendedor_id]?.nome,
    vendedor_email: vendedorMap[r.vendedor_id]?.email,
    area_id: r.area_id || null,
    time_id: r.time_id || null,
    google_event_id: r.google_event_id,
    transcript_file_id: r.transcript_file_id || null,
    sentimento: r.sentimento || null,
    meeting_code: r.link_meet ? r.link_meet.replace('https://meet.google.com/', '') : null,
    auditoria_manual: r.auditoria_manual || false,
  };
  });

  // Update durations in DB in background (fire-and-forget)
  if (toUpdateDuration.length > 0) {
    Promise.all(toUpdateDuration.map(({ id, minutos }) =>
      (supabase as any).schema('saas').from('reunioes').update({ duracao_minutos: minutos }).eq('id', id)
    )).catch(() => {});
  }

  return mapped;
}

/**
 * Ensure all @appmax participants across meetings are registered users.
 * Creates missing users with random MD5-hashed passwords.
 * Returns the list of newly created emails.
 */
export async function ensureAppmaxParticipantsRegistered(meetings: DbMeeting[]): Promise<string[]> {
  // Collect all unique @appmax emails from participants
  const appmaxEmails = new Set<string>();
  for (const m of meetings) {
    for (const p of m.participantes) {
      if (p.email && p.email.toLowerCase().endsWith('@appmax.com.br')) {
        appmaxEmails.add(normalizeEmail(p.email));
      }
    }
    // Also include vendedor email if present
    if (m.vendedor_email && m.vendedor_email.toLowerCase().endsWith('@appmax.com.br')) {
      appmaxEmails.add(normalizeEmail(m.vendedor_email));
    }
  }

  if (appmaxEmails.size === 0) return [];

  // Check which already exist
  const empresaId = await getSaasEmpresaId();
  const { data: existing } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('email')
    .eq('empresa_id', empresaId)
    .in('email', Array.from(appmaxEmails));

  const existingSet = new Set((existing || []).map((u: any) => normalizeEmail(u.email)));
  const missing = Array.from(appmaxEmails).filter(e => !existingSet.has(e));

  // Auto-create missing users
  const created: string[] = [];
  for (const email of missing) {
    try {
      await autoCreateAppmaxUser(email);
      created.push(email);
    } catch (e) {
      console.warn(`[meetings] Failed to auto-create user ${email}:`, e);
    }
  }

  return created;
}
