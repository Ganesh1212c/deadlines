-- Deadline Tracker — schedule the reminder sender
-- Run this in the Supabase SQL Editor AFTER you've deployed the
-- send-reminders Edge Function (see the setup instructions).
-- Replace the two placeholder values below before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Your Supabase project URL, e.g. https://wuyzjoasxnmrekufbluv.supabase.co
select vault.create_secret('REPLACE_WITH_YOUR_PROJECT_URL', 'project_url');

-- Your project's anon / publishable key (Settings -> API). This is only
-- used to satisfy Supabase's "is this a valid request" check on the way
-- in — the function itself uses its own service role key internally to
-- actually read/write the database.
select vault.create_secret('REPLACE_WITH_YOUR_ANON_KEY', 'function_key');

select cron.schedule(
  'send-reminders-every-30-min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'function_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it's running later:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
-- To stop it:
--   select cron.unschedule('send-reminders-every-30-min');
