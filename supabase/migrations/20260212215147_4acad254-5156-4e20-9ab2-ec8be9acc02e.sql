
-- User identity (about you section)
CREATE TABLE public.user_identity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  about_you text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own identity" ON public.user_identity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own identity" ON public.user_identity FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own identity" ON public.user_identity FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own identity" ON public.user_identity FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_user_identity_updated_at BEFORE UPDATE ON public.user_identity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User offers
CREATE TABLE public.user_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own offers" ON public.user_offers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own offers" ON public.user_offers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own offers" ON public.user_offers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own offers" ON public.user_offers FOR DELETE USING (auth.uid() = user_id);

-- User audiences
CREATE TABLE public.user_audiences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_audiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audiences" ON public.user_audiences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audiences" ON public.user_audiences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audiences" ON public.user_audiences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own audiences" ON public.user_audiences FOR DELETE USING (auth.uid() = user_id);

-- User personal info
CREATE TABLE public.user_personal_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_personal_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own personal info" ON public.user_personal_info FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own personal info" ON public.user_personal_info FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personal info" ON public.user_personal_info FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own personal info" ON public.user_personal_info FOR DELETE USING (auth.uid() = user_id);
