
-- Create user_sales_funnel table
CREATE TABLE public.user_sales_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  what text NOT NULL DEFAULT '',
  url text,
  price text,
  goal text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_sales_funnel ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own funnel" ON public.user_sales_funnel
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own funnel" ON public.user_sales_funnel
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own funnel" ON public.user_sales_funnel
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own funnel" ON public.user_sales_funnel
  FOR DELETE USING (auth.uid() = user_id);
