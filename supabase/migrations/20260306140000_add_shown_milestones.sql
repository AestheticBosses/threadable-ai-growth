-- Add shown_milestones column to profiles for milestone share system
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS shown_milestones JSONB DEFAULT '[]';
