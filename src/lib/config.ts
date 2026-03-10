// Configurações centralizadas do projeto.
// Valores lidos de import.meta.env com fallback hardcoded para garantir
// funcionamento em ambientes que não injetam .env (ex: Lovable).

export const CONFIG = {
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://lwusznsduxcqjjmbbobt.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_c0yDYJ79ltCXMGznHYyOQQ_Y2zjyhtY',

  // Google SSO
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '19779916042-ur7fs5qdorm32bsen7vtfcurkoka4sp7.apps.googleusercontent.com',
  GOOGLE_ALLOWED_DOMAIN: (import.meta.env.VITE_GOOGLE_ALLOWED_DOMAIN || 'appmax.com.br').trim().toLowerCase(),
  GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'https://smart-deal-coach.lovable.app/auth/google/callback',

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: import.meta.env.VITE_EVOLUTION_API_URL || 'https://evolutionapic.contato-lojavirtual.com',
  EVOLUTION_API_TOKEN: import.meta.env.VITE_EVOLUTION_API_TOKEN || '3ce7a42f9bd96ea526b2b0bc39a4faec',

  // OpenAI Tokens
  OPENAI_TOKEN_MEETINGS: import.meta.env.VITE_OPENAI_TOKEN_MEETINGS || '',
  OPENAI_TOKEN_TRAINING: import.meta.env.VITE_OPENAI_TOKEN_TRAINING || '',
  OPENAI_TOKEN_WHATSAPP: import.meta.env.VITE_OPENAI_TOKEN_WHATSAPP || '',
  OPENAI_TOKEN_REPORTS: import.meta.env.VITE_OPENAI_TOKEN_REPORTS || '',
  OPENAI_TOKEN_AUTOMATIONS: import.meta.env.VITE_OPENAI_TOKEN_AUTOMATIONS || '',
} as const;
