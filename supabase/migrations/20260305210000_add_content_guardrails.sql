CREATE TABLE user_content_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  guardrail_type TEXT NOT NULL CHECK (guardrail_type IN (
    'never_say',
    'never_reference',
    'always_frame',
    'voice_correction',
    'offer_guardrail'
  )),
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'inline_feedback')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_content_guardrails_user_id
  ON user_content_guardrails(user_id);

ALTER TABLE user_content_guardrails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own guardrails"
  ON user_content_guardrails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own guardrails"
  ON user_content_guardrails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guardrails"
  ON user_content_guardrails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own guardrails"
  ON user_content_guardrails FOR DELETE
  USING (auth.uid() = user_id);
