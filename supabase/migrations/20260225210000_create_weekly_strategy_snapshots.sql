CREATE TABLE IF NOT EXISTS weekly_strategy_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  archetypes jsonb,
  regression_insights jsonb,
  content_plan jsonb,
  created_at timestamptz DEFAULT now()
);
