-- Track when the user last applied CMO recommendations to their plan (7-day time gate)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_plan_applied_at TIMESTAMPTZ;
