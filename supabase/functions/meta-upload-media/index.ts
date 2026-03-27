/**
 * Edge Function: meta-upload-media
 * Proxy para upload de mídia na API da Meta (evita CORS do browser).
 * Para áudio: converte WAV/WebM → OGG/Opus se necessário.
 *
 * POST body: FormData com fields:
 *   - file: o arquivo
 *   - phone_number_id: ID do número
 *   - access_token: token de acesso
 *   - voice: "true" para enviar como mensagem de voz (opcional)
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
    let file = formData.get('file') as File;
    const phoneNumberId = formData.get('phone_number_id') as string;
    const accessToken = formData.get('access_token') as string;

    if (!file || !phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: 'Missing file, phone_number_id, or access_token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If audio, try to convert to OGG/Opus via ffmpeg (if available)
    const isAudio = file.type.startsWith('audio/') || file.name.endsWith('.wav') || file.name.endsWith('.webm') || file.name.endsWith('.ogg');
    const needsConversion = isAudio && !file.type.includes('ogg') && !file.name.endsWith('.mp3') && !file.name.endsWith('.aac') && !file.name.endsWith('.m4a');

    if (needsConversion) {
      try {
        // Write input file to /tmp
        const inputPath = `/tmp/input_${Date.now()}`;
        const outputPath = `/tmp/output_${Date.now()}.ogg`;
        const inputBytes = new Uint8Array(await file.arrayBuffer());
        await Deno.writeFile(inputPath, inputBytes);

        // Try ffmpeg conversion
        const process = new Deno.Command('ffmpeg', {
          args: ['-y', '-i', inputPath, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-f', 'ogg', outputPath],
          stdout: 'null',
          stderr: 'null',
        });
        const { success } = await process.output();

        if (success) {
          const oggBytes = await Deno.readFile(outputPath);
          file = new File([oggBytes], 'audio.ogg', { type: 'audio/ogg' });
          console.log('[meta-upload-media] Converted to OGG/Opus:', oggBytes.length, 'bytes');
        } else {
          console.warn('[meta-upload-media] ffmpeg conversion failed, sending original');
        }

        // Cleanup
        try { await Deno.remove(inputPath); } catch { /* */ }
        try { await Deno.remove(outputPath); } catch { /* */ }
      } catch (e) {
        console.warn('[meta-upload-media] ffmpeg not available or failed:', e.message);
        // Continue with original file
      }
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
