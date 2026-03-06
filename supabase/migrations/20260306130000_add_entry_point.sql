-- Add entry_point column to content_plan_items for vault story entry angle tracking
ALTER TABLE content_plan_items
ADD COLUMN IF NOT EXISTS entry_point TEXT;
