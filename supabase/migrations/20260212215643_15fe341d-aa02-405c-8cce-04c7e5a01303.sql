
-- Knowledge base table
CREATE TABLE public.knowledge_base (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('text', 'url', 'document', 'video')),
  content text,
  file_path text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own knowledge" ON public.knowledge_base FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge" ON public.knowledge_base FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge" ON public.knowledge_base FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own knowledge" ON public.knowledge_base FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge-docs', 'knowledge-docs', false);

-- Storage RLS: users can only manage files in their own folder
CREATE POLICY "Users can upload own knowledge docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own knowledge docs" ON storage.objects FOR SELECT USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own knowledge docs" ON storage.objects FOR DELETE USING (bucket_id = 'knowledge-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
