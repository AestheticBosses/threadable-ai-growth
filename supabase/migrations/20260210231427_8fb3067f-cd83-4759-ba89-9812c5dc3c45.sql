
-- Create user_story_vault table
CREATE TABLE public.user_story_vault (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('numbers', 'stories', 'offers', 'audience')),
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_story_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vault" ON public.user_story_vault FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own vault" ON public.user_story_vault FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vault" ON public.user_story_vault FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vault" ON public.user_story_vault FOR DELETE USING (auth.uid() = user_id);

-- Unique constraint: one row per section per user
CREATE UNIQUE INDEX idx_vault_user_section ON public.user_story_vault (user_id, section);

-- Trigger for updated_at
CREATE TRIGGER update_vault_updated_at BEFORE UPDATE ON public.user_story_vault FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add funnel_stage column to scheduled_posts
ALTER TABLE public.scheduled_posts ADD COLUMN funnel_stage TEXT;

-- Add funnel_goal to profiles
ALTER TABLE public.profiles ADD COLUMN funnel_goal TEXT DEFAULT 'grow';
ALTER TABLE public.profiles ADD COLUMN funnel_tof_pct INTEGER DEFAULT 70;
ALTER TABLE public.profiles ADD COLUMN funnel_mof_pct INTEGER DEFAULT 20;
ALTER TABLE public.profiles ADD COLUMN funnel_bof_pct INTEGER DEFAULT 10;
