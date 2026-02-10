
CREATE TABLE public.follower_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  follower_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own follower_snapshots"
  ON public.follower_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follower_snapshots"
  ON public.follower_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_follower_snapshots_user_recorded ON public.follower_snapshots (user_id, recorded_at DESC);
