
-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop existing profiles table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Create profiles table (id = auth.users.id)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  threads_user_id text,
  threads_username text,
  threads_access_token text,
  threads_token_expires_at timestamptz,
  is_established boolean DEFAULT false,
  niche text,
  dream_client text,
  end_goal text,
  voice_profile jsonb,
  onboarding_complete boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- competitor_accounts
CREATE TABLE public.competitor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  threads_username text,
  threads_user_id text,
  follower_count integer,
  niche_relevance_score float,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE public.competitor_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own competitor_accounts" ON public.competitor_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own competitor_accounts" ON public.competitor_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own competitor_accounts" ON public.competitor_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own competitor_accounts" ON public.competitor_accounts FOR DELETE USING (auth.uid() = user_id);

-- posts_analyzed
CREATE TABLE public.posts_analyzed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  threads_media_id text UNIQUE,
  source text,
  source_username text,
  text_content text,
  media_type text,
  posted_at timestamptz,
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  replies integer DEFAULT 0,
  reposts integer DEFAULT 0,
  quotes integer DEFAULT 0,
  shares integer DEFAULT 0,
  clicks integer DEFAULT 0,
  engagement_rate float,
  virality_score float,
  word_count integer,
  char_count integer,
  line_count integer,
  has_question boolean,
  has_credibility_marker boolean,
  has_emoji boolean,
  has_hashtag boolean,
  has_url boolean,
  starts_with_number boolean,
  sentiment_score float,
  content_category text,
  hour_posted integer,
  day_of_week text,
  fetched_at timestamptz DEFAULT now()
);

ALTER TABLE public.posts_analyzed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own posts_analyzed" ON public.posts_analyzed FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own posts_analyzed" ON public.posts_analyzed FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts_analyzed" ON public.posts_analyzed FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts_analyzed" ON public.posts_analyzed FOR DELETE USING (auth.uid() = user_id);

-- content_strategies
CREATE TABLE public.content_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_number integer,
  year integer,
  strategy_json jsonb,
  regression_insights jsonb,
  performance_vs_previous jsonb,
  status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own content_strategies" ON public.content_strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content_strategies" ON public.content_strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content_strategies" ON public.content_strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content_strategies" ON public.content_strategies FOR DELETE USING (auth.uid() = user_id);

-- scheduled_posts
CREATE TABLE public.scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strategy_id uuid REFERENCES public.content_strategies(id) ON DELETE SET NULL,
  text_content text,
  media_type text DEFAULT 'TEXT',
  media_url text,
  scheduled_for timestamptz,
  status text DEFAULT 'draft',
  threads_media_id text,
  ai_generated boolean DEFAULT true,
  content_category text,
  user_edited boolean DEFAULT false,
  published_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own scheduled_posts" ON public.scheduled_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scheduled_posts" ON public.scheduled_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled_posts" ON public.scheduled_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled_posts" ON public.scheduled_posts FOR DELETE USING (auth.uid() = user_id);

-- weekly_reports
CREATE TABLE public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date,
  week_end date,
  total_posts integer,
  total_views integer,
  total_engagement integer,
  avg_engagement_rate float,
  follower_count_start integer,
  follower_count_end integer,
  follower_growth integer,
  top_post_id uuid REFERENCES public.posts_analyzed(id) ON DELETE SET NULL,
  worst_post_id uuid REFERENCES public.posts_analyzed(id) ON DELETE SET NULL,
  insights jsonb,
  strategy_adjustments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own weekly_reports" ON public.weekly_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly_reports" ON public.weekly_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly_reports" ON public.weekly_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly_reports" ON public.weekly_reports FOR DELETE USING (auth.uid() = user_id);

-- voice_samples
CREATE TABLE public.voice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sample_text text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can select own voice_samples" ON public.voice_samples FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own voice_samples" ON public.voice_samples FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice_samples" ON public.voice_samples FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice_samples" ON public.voice_samples FOR DELETE USING (auth.uid() = user_id);
