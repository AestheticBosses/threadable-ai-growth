-- Add pov (point of view) column to content_plan_items for POV rotation
ALTER TABLE content_plan_items
ADD COLUMN IF NOT EXISTS pov TEXT;
