
CREATE TABLE public.post_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.scheduled_posts(id) ON DELETE CASCADE,
  comments_received integer,
  link_clicks integer,
  dm_replies integer,
  is_estimated boolean NOT NULL DEFAULT false,
  logged_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post_results" ON public.post_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own post_results" ON public.post_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own post_results" ON public.post_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own post_results" ON public.post_results FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert post_results" ON public.post_results FOR INSERT WITH CHECK (true);

CREATE INDEX idx_post_results_user_id ON public.post_results(user_id);
CREATE INDEX idx_post_results_post_id ON public.post_results(post_id);
