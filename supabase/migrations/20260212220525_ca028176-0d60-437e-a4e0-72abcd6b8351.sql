
-- Writing style selection
CREATE TABLE public.user_writing_style (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  selected_style text NOT NULL DEFAULT 'threadable',
  custom_style_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_writing_style ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own writing style" ON public.user_writing_style FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own writing style" ON public.user_writing_style FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own writing style" ON public.user_writing_style FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own writing style" ON public.user_writing_style FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_writing_style_updated_at BEFORE UPDATE ON public.user_writing_style FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Content preferences
CREATE TABLE public.content_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content preferences" ON public.content_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content preferences" ON public.content_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content preferences" ON public.content_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content preferences" ON public.content_preferences FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_content_preferences_updated_at BEFORE UPDATE ON public.content_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_content_preferences_user ON public.content_preferences(user_id, sort_order);
