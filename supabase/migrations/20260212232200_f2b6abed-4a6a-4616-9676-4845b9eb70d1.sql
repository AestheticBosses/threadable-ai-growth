
-- Add source column to scheduled_posts for tracking where posts came from
ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS source text;
