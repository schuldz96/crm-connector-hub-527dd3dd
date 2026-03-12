import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Create a signed JWT for Google service account authentication.
 * Uses Web Crypto API (available in Deno/Edge Functions).
 */
async function createGoogleJWT(
  clientEmail: string,
  privateKeyPem: string,
  scopes: string[],
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer | Uint8Array) =>
    btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput));
  return `${signingInput}.${b64url(signature)}`;
}

/**
 * Exchange a signed JWT for a Google access token.
 */
async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await createGoogleJWT(clientEmail, privateKey, [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ]);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token error: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Fetch plain text content from a Google Doc by file ID.
 */
async function fetchGoogleDocText(fileId: string, accessToken: string): Promise<string> {
  // Export as plain text via Drive API
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive export error (${fileId}): ${res.status} ${err}`);
  }

  return await res.text();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Google credentials from Supabase secrets
    const googleClientEmail = Deno.env.get('GOOGLE_SA_CLIENT_EMAIL');
    const googlePrivateKey = Deno.env.get('GOOGLE_SA_PRIVATE_KEY');

    if (!googleClientEmail || !googlePrivateKey) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Google não configuradas. Configure GOOGLE_SA_CLIENT_EMAIL e GOOGLE_SA_PRIVATE_KEY nos secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Parse request
    const { empresa_id } = await req.json();
    if (!empresa_id) {
      return new Response(JSON.stringify({ error: 'empresa_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'saas' },
    });

    // Get all reunioes that have transcript_file_id but placeholder/empty transcricao
    const { data: meetings, error: fetchErr } = await supabase
      .from('reunioes')
      .select('id, transcript_file_id, transcricao')
      .eq('empresa_id', empresa_id)
      .not('transcript_file_id', 'is', null);

    if (fetchErr) throw new Error(`DB fetch error: ${fetchErr.message}`);

    // Filter: needs fetching if transcricao is null, empty, or is the placeholder
    const needsFetch = (meetings || []).filter(
      (m: any) =>
        !m.transcricao ||
        m.transcricao.startsWith('[Transcrição no Drive:'),
    );

    if (needsFetch.length === 0) {
      return new Response(
        JSON.stringify({ fetched: 0, total: meetings?.length || 0, message: 'Todas as transcrições já foram importadas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get Google access token (one token for all requests)
    const accessToken = await getGoogleAccessToken(googleClientEmail, googlePrivateKey);

    let fetched = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const meeting of needsFetch) {
      try {
        const text = await fetchGoogleDocText(meeting.transcript_file_id, accessToken);

        if (text && text.trim().length > 10) {
          const { error: updateErr } = await supabase
            .from('reunioes')
            .update({ transcricao: text.trim() })
            .eq('id', meeting.id);

          if (updateErr) {
            errors++;
            errorDetails.push(`${meeting.id}: ${updateErr.message}`);
          } else {
            fetched++;
          }
        }
      } catch (e) {
        errors++;
        errorDetails.push(`${meeting.id} (file: ${meeting.transcript_file_id}): ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        fetched,
        errors,
        pending: needsFetch.length - fetched - errors,
        total: meetings?.length || 0,
        errorDetails: errorDetails.length > 0 ? errorDetails.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('fetch-transcripts error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
