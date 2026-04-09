import { supabase } from '@/integrations/supabase/client';

interface OpenAIRequest {
  model: string;
  messages: { role: string; content: string | any[] }[];
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call OpenAI chat completions.
 * Strategy: try Supabase RPC (server-side, no CORS issues) → fallback to direct API call.
 */
export async function callOpenAI(apiToken: string, payload: OpenAIRequest): Promise<any> {
  // Check if payload contains multimodal content (images as base64)
  const hasMultimodal = payload.messages.some(m => Array.isArray(m.content));

  // For multimodal (vision) requests, skip RPC (too large for DB HTTP) and call API directly
  if (!hasMultimodal) {
    // 1) Try server-side call via Supabase RPC (avoids browser CORS/CSP)
    try {
      const { data, error } = await (supabase as any)
        .schema('ai')
        .rpc('openai_chat', {
          p_token: apiToken,
          p_model: payload.model || 'gpt-4o-mini',
          p_messages: payload.messages,
          p_temperature: payload.temperature ?? 0.3,
          p_max_tokens: payload.max_tokens ?? 1500,
        });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (rpcErr: any) {
      console.error('[openai] RPC failed:', rpcErr?.message, rpcErr);
    }
  }

  // 2) Direct API call (used for multimodal or as fallback)
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI HTTP ${response.status}`);
  }

  return await response.json();
}
