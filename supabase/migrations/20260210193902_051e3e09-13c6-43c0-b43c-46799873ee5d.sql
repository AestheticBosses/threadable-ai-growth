
-- Add profile picture URL column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS threads_profile_picture_url text;
