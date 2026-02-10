
-- Add content preference columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_posts_per_day integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS include_credibility_markers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_approve_ai_posts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generate_weekend_posts boolean NOT NULL DEFAULT false;
