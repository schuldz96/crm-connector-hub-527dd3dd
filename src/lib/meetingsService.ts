/**
 * Service for loading and syncing meetings from the database.
 */
import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

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
  vendedor_nome?: string;
  vendedor_email?: string;
  google_event_id?: string;
  transcript_file_id?: string | null;
}

// ─── Transcription API config ────────────────────────────────────────────────
const TRANSCRIPT_API_URL = 'https://appreciate-continuously-percentage-ranks.trycloudflare.com/run';
const TRANSCRIPT_API_TOKEN = 'api-meet-comercial';

/**
 * Step 1: Sync appmax.meet_conferences → saas.reunioes via RPC
 */
export async function syncMeetConferences(): Promise<{ inserted: number; updated: number }> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any).rpc('sincronizar_reunioes', {
    p_empresa_id: empresaId,
  });

  if (error) throw new Error(`Sync error: ${error.message}`);
  return data || { inserted: 0, updated: 0 };
}

/**
 * Step 2: Trigger the transcription fetcher API for a date range.
 * This tells the external service to fetch transcriptions from Google Drive.
 */
export async function triggerTranscriptionFetch(since: string): Promise<void> {
  const res = await fetch(TRANSCRIPT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-token': TRANSCRIPT_API_TOKEN,
    },
    body: JSON.stringify({ since }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcription API error ${res.status}: ${text}`);
  }
}

/**
 * Step 3: After transcription API runs, pull transcript_copied_file_id
 * from appmax.meet_conferences into saas.reunioes, then read the
 * Google Doc content and save as text in the transcricao column.
 */
export async function pullTranscriptions(): Promise<number> {
  const empresaId = await getSaasEmpresaId();

  // Get meetings that have no transcription yet but may have a file in meet_conferences
  const { data: meetings } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('id, google_event_id, transcricao, transcript_file_id')
    .eq('empresa_id', empresaId)
    .is('transcricao', null);

  if (!meetings || meetings.length === 0) return 0;

  // For each meeting, check if meet_conferences has a transcript
  let count = 0;
  for (const m of meetings) {
    if (!m.google_event_id) continue;

    // Query appmax.meet_conferences for transcript file IDs via RPC
    const { data: fileData } = await (supabase as any).rpc('buscar_transcript_file', {
      p_conference_key: m.google_event_id,
    });

    const fileId = fileData?.transcript_copied_file_id;
    if (!fileId) continue;

    // Read Google Doc content via export as plain text
    try {
      const docText = await fetchGoogleDocAsText(fileId);
      if (docText && docText.trim().length > 10) {
        await (supabase as any)
          .schema('saas')
          .from('reunioes')
          .update({
            transcricao: docText,
            transcript_file_id: fileId,
          })
          .eq('id', m.id);
        count++;
      }
    } catch (err) {
      console.warn(`[meetings] Failed to fetch transcript for ${m.id}:`, err);
    }
  }

  return count;
}

/**
 * Fetch a Google Doc as plain text using the export link.
 * Works for Docs that are publicly shared or shared with the service.
 */
async function fetchGoogleDocAsText(fileId: string): Promise<string> {
  const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error(`Google Doc export failed: ${res.status}`);
  return await res.text();
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

  // Resolve vendedor_id → name/email
  const vendedorIds = [...new Set((data || []).map((r: any) => r.vendedor_id).filter(Boolean))];
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

  return (data || []).map((r: any) => ({
    id: r.id,
    titulo: r.titulo || '',
    data_reuniao: r.data_reuniao,
    duracao_minutos: r.duracao_minutos || 0,
    cliente_nome: r.cliente_nome,
    cliente_email: r.cliente_email,
    link_meet: r.link_meet,
    status: r.status || 'agendada',
    score: r.score,
    analisada_por_ia: r.analisada_por_ia || false,
    participantes: Array.isArray(r.participantes) ? r.participantes : [],
    transcricao: r.transcricao || null,
    vendedor_nome: vendedorMap[r.vendedor_id]?.nome,
    vendedor_email: vendedorMap[r.vendedor_id]?.email,
    google_event_id: r.google_event_id,
  }));
}
