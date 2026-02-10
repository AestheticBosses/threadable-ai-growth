ALTER TABLE public.posts_analyzed ALTER COLUMN source SET DEFAULT 'own';
UPDATE public.posts_analyzed SET source = 'own' WHERE source IS NULL;