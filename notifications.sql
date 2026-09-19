-- Deadline Tracker — push notifications
-- Run this once in the Supabase SQL Editor, AFTER schema.sql.
-- Safe to re-run: everything here uses "if not exists" / "create or
-- replace", and none of it touches the assignments table or its data.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
-- No select/insert/update/delete policies on purpose: with RLS on and no
-- policies, direct table access is blocked for everyone. The only way in
-- or out is through the two functions below (subscribing, which needs no
-- passcode — it only ever affects the visitor's own browser) or the
-- service role key used by the scheduled reminder function.

create table if not exists sent_reminders (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamptz not null default now(),
  unique (assignment_id, subscription_id, reminder_type)
);

alter table sent_reminders enable row level security;
-- Also no public policies — only the reminder function (via the service
-- role key, which bypasses RLS) ever touches this table.

create or replace function subscribe_to_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into push_subscriptions (endpoint, p256dh, auth)
  values (p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do nothing;
end;
$$;

create or replace function unsubscribe_from_push(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_subscriptions where endpoint = p_endpoint;
end;
$$;

grant execute on function subscribe_to_push(text, text, text) to anon, authenticated;
grant execute on function unsubscribe_from_push(text) to anon, authenticated;
