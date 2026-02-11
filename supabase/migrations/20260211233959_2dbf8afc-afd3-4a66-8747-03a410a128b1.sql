
CREATE TABLE public.waitlist_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public waitlist form, no auth required)
CREATE POLICY "Anyone can insert waitlist signups"
ON public.waitlist_signups
FOR INSERT
WITH CHECK (true);

-- Only authenticated service role can read (no public reads needed)
-- No SELECT/UPDATE/DELETE policies for anon users
