// Configurações centralizadas do projeto.
// Valores lidos de import.meta.env com fallback hardcoded para garantir
// funcionamento em ambientes que não injetam .env (ex: Lovable).

export const CONFIG = {
  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://ugdojctvzifycofqzelf.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZG9qY3R2emlmeWNvZnF6ZWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTY4NzEsImV4cCI6MjA5MTI3Mjg3MX0.wWeGE9Vd0Fu50gq3tfuJBaDiTs_S3Jzgb2rbaIxSiWk',

  // Google SSO
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '19779916042-ur7fs5qdorm32bsen7vtfcurkoka4sp7.apps.googleusercontent.com',
  GOOGLE_ALLOWED_DOMAIN: (import.meta.env.VITE_GOOGLE_ALLOWED_DOMAIN || 'gmail.com').trim().toLowerCase(),
  GOOGLE_REDIRECT_URI: import.meta.env.VITE_GOOGLE_REDIRECT_URI || '',

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: import.meta.env.VITE_EVOLUTION_API_URL || 'https://evolutionapic.contato-lojavirtual.com',
  EVOLUTION_API_TOKEN: import.meta.env.VITE_EVOLUTION_API_TOKEN || '',

  // OpenAI Tokens — loaded ONLY from database, not from env vars
  // DO NOT add env vars here — they caused token contamination (Evolution token in meetings field)
} as const;
