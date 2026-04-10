-- Add webhook health tracking column to meta_inbox_accounts
-- Tracks the last time the webhook received an event for this account
ALTER TABLE public.meta_inbox_accounts
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

-- Backfill with updated_at so existing accounts don't show stale immediately
UPDATE public.meta_inbox_accounts SET last_webhook_at = updated_at WHERE last_webhook_at IS NULL;
