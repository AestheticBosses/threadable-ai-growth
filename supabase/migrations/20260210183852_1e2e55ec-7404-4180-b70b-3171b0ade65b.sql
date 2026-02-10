
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS follows integer DEFAULT 0;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS follow_rate numeric DEFAULT 0;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_namedrop boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_dollar_amount boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_vulnerability boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_controversy boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_relatability boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_profanity boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_visual boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS is_short_form boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS has_steps boolean DEFAULT false;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS emotion_count integer DEFAULT 0;
ALTER TABLE posts_analyzed ADD COLUMN IF NOT EXISTS archetype text DEFAULT 'truth';
