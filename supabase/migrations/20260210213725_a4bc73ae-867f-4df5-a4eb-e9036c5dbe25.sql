
-- Add strategy_type and strategy_data columns to content_strategies
ALTER TABLE public.content_strategies
ADD COLUMN IF NOT EXISTS strategy_type text DEFAULT 'weekly';

ALTER TABLE public.content_strategies
ADD COLUMN IF NOT EXISTS strategy_data jsonb;

-- Create unique constraint on (user_id, strategy_type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_content_strategies_user_type
ON public.content_strategies (user_id, strategy_type);
