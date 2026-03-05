ALTER TABLE content_plan_items
ADD COLUMN IF NOT EXISTS draft_length_signal TEXT CHECK (draft_length_signal IN ('MICRO', 'SHORT', 'STANDARD')) DEFAULT 'STANDARD';
