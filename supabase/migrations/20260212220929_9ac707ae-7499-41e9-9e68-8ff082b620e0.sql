
-- Add desired_perception and main_goal columns to user_identity
ALTER TABLE public.user_identity
ADD COLUMN IF NOT EXISTS desired_perception text,
ADD COLUMN IF NOT EXISTS main_goal text;
