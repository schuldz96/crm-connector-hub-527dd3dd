/**
 * Edge Function: meta-upload-media
 * Proxy para upload de mídia na API da Meta (evita CORS do browser).
 *
 * POST body: FormData com fields:
 *   - file: o arquivo
 *   - phone_number_id: ID do número
 *   - access_token: token de acesso
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const phoneNumberId = formData.get('phone_number_id') as string;
    const accessToken = formData.get('access_token') as string;

    if (!file || !phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: 'Missing file, phone_number_id, or access_token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Forward to Meta API
    const metaForm = new FormData();
    metaForm.append('messaging_product', 'whatsapp');
    metaForm.append('file', file);
    metaForm.append('type', file.type);

    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: metaForm,
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
