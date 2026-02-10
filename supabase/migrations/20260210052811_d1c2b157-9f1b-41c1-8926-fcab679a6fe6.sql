-- Add pre_post_score and score_breakdown columns to scheduled_posts
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS pre_post_score integer,
ADD COLUMN IF NOT EXISTS score_breakdown jsonb;