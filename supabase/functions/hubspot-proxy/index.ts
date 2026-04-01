/**
 * Edge Function: hubspot-proxy
 * Proxy para HubSpot API — evita CORS no browser.
 * Recebe token via header x-hubspot-token e faz forward para api.hubapi.com.
 */
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const HUBSPOT_API = 'https://api.hubapi.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-hubspot-token, x-hubspot-path, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = req.headers.get('x-hubspot-token');
    if (!token) return new Response(JSON.stringify({ error: 'Missing x-hubspot-token header' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Path comes from header or body
    let hsPath = req.headers.get('x-hubspot-path') || '';
    let method = 'GET';
    let body: string | undefined;

    if (req.method === 'POST') {
      const payload = await req.json();
      hsPath = payload.path || hsPath;
      method = payload.method || 'GET';
      body = payload.body ? JSON.stringify(payload.body) : undefined;
    }

    if (!hsPath) return new Response(JSON.stringify({ error: 'Missing path' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Forward to HubSpot
    const url = `${HUBSPOT_API}${hsPath.startsWith('/') ? hsPath : '/' + hsPath}`;
    const hsRes = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await hsRes.json();

    return new Response(JSON.stringify(data), {
      status: hsRes.ok ? 200 : hsRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
