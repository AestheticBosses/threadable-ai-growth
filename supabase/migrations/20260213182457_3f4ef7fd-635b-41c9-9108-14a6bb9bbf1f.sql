
-- Add metadata column to chat_messages for persisting post preview data
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Add pinned columns to chat_sessions
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS pinned_at timestamp with time zone DEFAULT NULL;
