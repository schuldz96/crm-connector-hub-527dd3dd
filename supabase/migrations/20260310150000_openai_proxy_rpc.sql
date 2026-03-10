-- Enable the http extension for making HTTP calls from database functions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- RPC function to proxy OpenAI chat completions
CREATE OR REPLACE FUNCTION saas.openai_chat(
  p_token text,
  p_model text DEFAULT 'gpt-4o-mini',
  p_messages jsonb DEFAULT '[]'::jsonb,
  p_temperature numeric DEFAULT 0.3,
  p_max_tokens integer DEFAULT 1500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response extensions.http_response;
  body jsonb;
BEGIN
  body := jsonb_build_object(
    'model', p_model,
    'messages', p_messages,
    'temperature', p_temperature,
    'max_tokens', p_max_tokens
  );

  SELECT * INTO response FROM extensions.http((
    'POST',
    'https://api.openai.com/v1/chat/completions',
    ARRAY[
      extensions.http_header('Authorization', 'Bearer ' || p_token),
      extensions.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    body::text
  )::extensions.http_request);

  IF response.status != 200 THEN
    RETURN jsonb_build_object('error', 'OpenAI HTTP ' || response.status, 'body', response.content::jsonb);
  END IF;

  RETURN response.content::jsonb;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION saas.openai_chat TO anon, authenticated;
