-- Content Strategy V2: Buckets, Pillars, Topics, Plans, Weekly Reviews
-- Run via Supabase Dashboard > SQL Editor

-- ============================================
-- 1. New columns on profiles
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mission TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS traffic_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS posting_cadence TEXT DEFAULT '1x_daily';

-- ============================================
-- 2. content_buckets — WHO they're talking to
-- ============================================
CREATE TABLE IF NOT EXISTS content_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  audience_persona TEXT,
  business_connection TEXT,
  priority INTEGER CHECK (priority BETWEEN 1 AND 3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content_buckets"
  ON content_buckets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_buckets_user_id ON content_buckets(user_id);

-- ============================================
-- 3. content_pillars — WHAT topics they cover
-- ============================================
CREATE TABLE IF NOT EXISTS content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket_id UUID REFERENCES content_buckets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT CHECK (purpose IN ('inspire', 'educate', 'motivate', 'entertain')),
  percentage INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content_pillars"
  ON content_pillars FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_pillars_user_id ON content_pillars(user_id);
CREATE INDEX IF NOT EXISTS idx_content_pillars_bucket_id ON content_pillars(bucket_id);

-- ============================================
-- 4. connected_topics — Angles within pillars
-- ============================================
CREATE TABLE IF NOT EXISTS connected_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pillar_id UUID REFERENCES content_pillars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hook_angle TEXT,
  used_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE connected_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connected_topics"
  ON connected_topics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_connected_topics_user_id ON connected_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_topics_pillar_id ON connected_topics(pillar_id);

-- ============================================
-- 5. content_plan_items — 30-day schedule
-- ============================================
CREATE TABLE IF NOT EXISTS content_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_week INTEGER NOT NULL,
  plan_day INTEGER NOT NULL,
  scheduled_date DATE,
  pillar_id UUID REFERENCES content_pillars(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES connected_topics(id) ON DELETE SET NULL,
  archetype TEXT,
  funnel_stage TEXT CHECK (funnel_stage IN ('TOF', 'MOF', 'BOF')),
  is_test_slot BOOLEAN DEFAULT false,
  post_id UUID,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'drafted', 'published', 'skipped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own content_plan_items"
  ON content_plan_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_plan_items_user_id ON content_plan_items(user_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_items_scheduled_date ON content_plan_items(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_content_plan_items_pillar_id ON content_plan_items(pillar_id);
CREATE INDEX IF NOT EXISTS idx_content_plan_items_topic_id ON content_plan_items(topic_id);

-- ============================================
-- 6. weekly_reviews — Performance analysis
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  review_date DATE NOT NULL,
  pillar_performance JSONB DEFAULT '{}'::jsonb,
  archetype_performance JSONB DEFAULT '{}'::jsonb,
  topic_performance JSONB DEFAULT '{}'::jsonb,
  top_combos JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weekly_reviews"
  ON weekly_reviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id ON weekly_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_review_date ON weekly_reviews(review_date);

-- ============================================
-- 7. Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_buckets_updated_at
  BEFORE UPDATE ON content_buckets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_pillars_updated_at
  BEFORE UPDATE ON content_pillars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_plan_items_updated_at
  BEFORE UPDATE ON content_plan_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
