ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_weekly_refresh_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_refresh_summary jsonb;
