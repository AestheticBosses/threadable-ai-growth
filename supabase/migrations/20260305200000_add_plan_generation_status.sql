ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS plan_generation_status TEXT DEFAULT 'idle';
