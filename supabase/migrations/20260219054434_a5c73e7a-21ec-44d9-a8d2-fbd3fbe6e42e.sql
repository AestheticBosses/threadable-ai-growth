ALTER TABLE public.content_strategies 
ADD COLUMN IF NOT EXISTS journey_stage text 
CHECK (journey_stage IN ('getting_started', 'growing', 'monetizing'));