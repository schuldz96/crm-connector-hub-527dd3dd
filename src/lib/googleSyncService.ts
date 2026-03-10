import { supabase } from '@/integrations/supabase/client';
import { getSaasEmpresaId } from '@/lib/saas';

const APPMAX_DOMAIN = 'appmax.com.br';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { conferenceSolution?: { name?: string }; entryPoints?: { uri?: string }[] };
}

interface SyncedMeeting {
  google_event_id: string;
  titulo: string;
  data_reuniao: string;
  duracao_minutos: number;
  cliente_nome: string | null;
  cliente_email: string | null;
  link_meet: string | null;
  participantes: { email: string; name?: string }[];
  transcricao: string | null;
  status: string;
}

export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  errors: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isExternalEmail(email: string): boolean {
  return !email.toLowerCase().endsWith(`@${APPMAX_DOMAIN}`);
}

function hasExternalParticipants(attendees: { email: string }[]): boolean {
  return attendees.some(a => isExternalEmail(a.email));
}

function getMeetLink(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find(e => e.uri?.includes('meet.google.com'));
  return entry?.uri ?? null;
}

function calcDurationMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / 60000);
}

/** Extract first external participant as the "client" */
function getClientInfo(attendees: { email: string; displayName?: string }[]): {
  nome: string | null;
  email: string | null;
} {
  const ext = attendees.find(a => isExternalEmail(a.email));
  if (!ext) return { nome: null, email: null };
  return { nome: ext.displayName || ext.email.split('@')[0], email: ext.email };
}

// ─── Google API calls ────────────────────────────────────────────────────────

/**
 * Fetch calendar events from the last N days that have a Google Meet link.
 * Uses the user's short-lived access token from OAuth implicit flow.
 */
async function fetchCalendarEvents(
  accessToken: string,
  daysBack: number = 30,
): Promise<CalendarEvent[]> {
  const timeMin = new Date(Date.now() - daysBack * 86400000).toISOString();
  const timeMax = new Date().toISOString();

  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      // Request conference data so we can detect Meet links on ad-hoc calls
      conferenceDataVersion: '1',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google Calendar API HTTP ${res.status}`);
    }

    const json = await res.json();
    allEvents.push(...(json.items || []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  return allEvents;
}

/**
 * Search Google Drive for transcript documents related to a meeting.
 * Google Meet transcriptions are saved as Google Docs in Drive with names like:
 * "[Meeting title] - Transcript" or contain the Meet code in the title.
 */
async function findTranscriptInDrive(
  accessToken: string,
  meetLink: string | null,
  eventTitle: string,
  eventDate: string,
): Promise<string | null> {
  if (!meetLink && !eventTitle) return null;

  // Extract Meet code from link (e.g., "abc-defg-hij" from "https://meet.google.com/abc-defg-hij")
  const meetCode = meetLink?.match(/meet\.google\.com\/([a-z\-]+)/i)?.[1] || '';

  // Search for transcript docs — Google auto-names them with meeting title or Meet code
  const queries: string[] = [];

  if (eventTitle) {
    // Google Meet transcript naming: "{title} - Transcript" or "{title} - Transcrição"
    queries.push(`name contains '${eventTitle.replace(/'/g, "\\'")} - Trans'`);
  }
  if (meetCode) {
    queries.push(`name contains '${meetCode}'`);
  }

  // Also search by date-based naming pattern
  const dateStr = new Date(eventDate).toISOString().split('T')[0];
  if (eventTitle) {
    queries.push(`name contains '${eventTitle.replace(/'/g, "\\'")}' and modifiedTime >= '${dateStr}T00:00:00Z' and modifiedTime <= '${dateStr}T23:59:59Z'`);
  }

  for (const q of queries) {
    try {
      const fullQuery = `${q} and mimeType='application/vnd.google-apps.document' and trashed=false`;
      const params = new URLSearchParams({
        q: fullQuery,
        fields: 'files(id,name)',
        pageSize: '5',
      });

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!res.ok) continue;

      const json = await res.json();
      const files = json.files || [];

      if (files.length > 0) {
        // Found a transcript doc — export as plain text
        const fileId = files[0].id;
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        if (exportRes.ok) {
          const text = await exportRes.text();
          if (text.trim().length > 0) return text.trim();
        }
      }
    } catch {
      // Try next query
      continue;
    }
  }

  return null;
}

// ─── Main sync function ──────────────────────────────────────────────────────

/**
 * Sync Google Meet transcripts to the database.
 * Only syncs meetings with at least one non-@appmax.com.br participant.
 * Includes ad-hoc calls (created on the fly) as long as they have a Meet link.
 */
export async function syncGoogleMeetTranscripts(
  accessToken: string,
  vendedorEmail: string,
  daysBack: number = 30,
  onProgress?: (msg: string) => void,
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, synced: 0, skipped: 0, errors: [] };

  onProgress?.('Buscando eventos do Google Calendar...');

  // 1) Fetch all calendar events
  let events: CalendarEvent[];
  try {
    events = await fetchCalendarEvents(accessToken, daysBack);
  } catch (err: any) {
    result.errors.push(`Erro ao buscar Calendar: ${err.message}`);
    return result;
  }

  // 2) Filter: must have Meet link AND at least one external participant
  const meetEvents = events.filter(e => {
    const link = getMeetLink(e);
    if (!link) return false;
    const attendees = e.attendees || [];
    // If no attendees list (ad-hoc call), we can't determine external participants — skip
    if (attendees.length === 0) return false;
    return hasExternalParticipants(attendees);
  });

  result.total = meetEvents.length;
  onProgress?.(`${meetEvents.length} reuniões com participantes externos encontradas.`);

  if (meetEvents.length === 0) return result;

  // 3) Get existing synced event IDs to skip duplicates
  const empresaId = await getSaasEmpresaId();
  const eventIds = meetEvents.map(e => e.id);

  const { data: existingRows } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('google_event_id')
    .eq('empresa_id', empresaId)
    .in('google_event_id', eventIds);

  const alreadySynced = new Set((existingRows || []).map((r: any) => r.google_event_id));

  // 4) Resolve vendedor email → UUID
  const { data: vendedorRow } = await (supabase as any)
    .schema('saas')
    .from('usuarios')
    .select('id, area_id, time_id')
    .eq('empresa_id', empresaId)
    .eq('email', vendedorEmail.trim().toLowerCase())
    .maybeSingle();

  const vendedorId = vendedorRow?.id ?? null;
  const areaId = vendedorRow?.area_id ?? null;
  const timeId = vendedorRow?.time_id ?? null;

  // 5) Process each event
  for (let i = 0; i < meetEvents.length; i++) {
    const event = meetEvents[i];

    if (alreadySynced.has(event.id)) {
      result.skipped++;
      continue;
    }

    onProgress?.(`Sincronizando ${i + 1}/${meetEvents.length}: ${event.summary || 'Sem título'}...`);

    const startTime = event.start?.dateTime || event.start?.date || '';
    const endTime = event.end?.dateTime || event.end?.date || '';
    const meetLink = getMeetLink(event);
    const attendees = event.attendees || [];
    const client = getClientInfo(attendees);
    const duration = calcDurationMinutes(startTime, endTime);

    const participantes = attendees.map(a => ({
      email: a.email,
      name: a.displayName || a.email.split('@')[0],
    }));

    // Try to find transcript in Google Drive
    let transcricao: string | null = null;
    try {
      transcricao = await findTranscriptInDrive(
        accessToken,
        meetLink,
        event.summary || '',
        startTime,
      );
    } catch {
      // Non-fatal — meeting still gets saved without transcript
    }

    // 6) Insert into DB
    try {
      const { error } = await (supabase as any)
        .schema('saas')
        .from('reunioes')
        .insert({
          empresa_id: empresaId,
          area_id: areaId,
          time_id: timeId,
          vendedor_id: vendedorId,
          google_event_id: event.id,
          titulo: event.summary || 'Reunião Google Meet',
          data_reuniao: startTime,
          duracao_minutos: duration,
          cliente_nome: client.nome,
          cliente_email: client.email,
          link_meet: meetLink,
          participantes: JSON.stringify(participantes),
          transcricao,
          status: endTime && new Date(endTime) < new Date() ? 'concluida' : 'agendada',
          analisada_por_ia: false,
        });

      if (error) {
        // Skip duplicate constraint violations silently
        if (error.code === '23505') {
          result.skipped++;
        } else {
          result.errors.push(`${event.summary}: ${error.message}`);
        }
      } else {
        result.synced++;
      }
    } catch (err: any) {
      result.errors.push(`${event.summary}: ${err.message}`);
    }
  }

  onProgress?.(`Sincronização concluída: ${result.synced} novas, ${result.skipped} já existentes.`);
  return result;
}

// ─── Load meetings from DB ───────────────────────────────────────────────────

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
}

export async function loadMeetingsFromDb(): Promise<DbMeeting[]> {
  const empresaId = await getSaasEmpresaId();

  const { data, error } = await (supabase as any)
    .schema('saas')
    .from('reunioes')
    .select('id, titulo, data_reuniao, duracao_minutos, cliente_nome, cliente_email, link_meet, status, score, analisada_por_ia, participantes, transcricao, vendedor_id, google_event_id')
    .eq('empresa_id', empresaId)
    .order('data_reuniao', { ascending: false });

  if (error || !data) return [];

  // Resolve vendedor UUIDs to names/emails
  const vendedorIds = [...new Set(data.map((r: any) => r.vendedor_id).filter(Boolean))];
  let vendedorMap: Record<string, { nome: string; email: string }> = {};

  if (vendedorIds.length > 0) {
    const { data: users } = await (supabase as any)
      .schema('saas')
      .from('usuarios')
      .select('id, nome, email')
      .eq('empresa_id', empresaId)
      .in('id', vendedorIds);

    for (const u of (users || [])) {
      vendedorMap[u.id] = { nome: u.nome, email: u.email };
    }
  }

  return data.map((r: any) => ({
    id: r.id,
    titulo: r.titulo,
    data_reuniao: r.data_reuniao,
    duracao_minutos: r.duracao_minutos,
    cliente_nome: r.cliente_nome,
    cliente_email: r.cliente_email,
    link_meet: r.link_meet,
    status: r.status,
    score: r.score,
    analisada_por_ia: r.analisada_por_ia,
    participantes: typeof r.participantes === 'string' ? JSON.parse(r.participantes) : (r.participantes || []),
    transcricao: r.transcricao,
    vendedor_nome: r.vendedor_id ? vendedorMap[r.vendedor_id]?.nome : undefined,
    vendedor_email: r.vendedor_id ? vendedorMap[r.vendedor_id]?.email : undefined,
    google_event_id: r.google_event_id,
  }));
}
