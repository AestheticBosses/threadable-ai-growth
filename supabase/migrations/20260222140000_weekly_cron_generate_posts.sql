-- Weekly cron job: every Sunday at 2PM UTC (8AM Mountain Time)
-- For each active subscriber, call generate-week-posts edge function via pg_net

CREATE OR REPLACE FUNCTION public.cron_generate_week_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _supabase_url text := 'https://iobnntqhmswxtubkdjon.supabase.co';
  _service_key text := current_setting('app.settings.service_role_key', true);
  _edge_fn_url text;
  _request_id bigint;
BEGIN
  _edge_fn_url := _supabase_url || '/functions/v1/generate-week-posts';

  FOR _user_id IN
    SELECT s.user_id FROM subscriptions s WHERE s.status = 'active'
  LOOP
    SELECT net.http_post(
      url := _edge_fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_key
      ),
      body := jsonb_build_object('user_id', _user_id::text)
    ) INTO _request_id;

    RAISE LOG 'cron_generate_week_posts: user_id=%, request_id=%', _user_id, _request_id;
  END LOOP;
END;
$$;

-- Schedule: every Sunday at 14:00 UTC (8AM Mountain Time)
SELECT cron.schedule(
  'weekly-generate-posts',
  '0 14 * * 0',
  $$SELECT public.cron_generate_week_posts()$$
);
