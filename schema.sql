-- Deadline Tracker — Supabase schema
-- Run this once in your Supabase project's SQL Editor.

create extension if not exists pgcrypto;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  assignment_name text not null,
  assignment_type text not null default 'Assignment',
  due_date date not null,
  is_extended boolean not null default false,
  extended_date date,
  created_at timestamptz not null default now()
);

-- Row-level security: everyone can read. Nobody can write directly — all
-- writes must go through the passcode-checked functions below, which run
-- with the table owner's privileges (security definer) and bypass RLS
-- themselves once the passcode check passes.
alter table assignments enable row level security;

drop policy if exists "Public read access" on assignments;
create policy "Public read access" on assignments
  for select using (true);

-- Checks a passcode without writing anything. Used by the editor page to
-- show a proper "incorrect passcode" message before letting anyone in.
create or replace function verify_passcode(passcode text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select passcode = '5555';
$$;

create or replace function add_assignment(
  passcode text,
  p_subject text,
  p_assignment_name text,
  p_assignment_type text,
  p_due_date date
) returns assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row assignments;
begin
  if passcode <> '5555' then
    raise exception 'Invalid passcode';
  end if;

  insert into assignments (subject, assignment_name, assignment_type, due_date)
  values (p_subject, p_assignment_name, p_assignment_type, p_due_date)
  returning * into new_row;

  return new_row;
end;
$$;

create or replace function update_assignment(
  passcode text,
  p_id uuid,
  p_subject text,
  p_assignment_name text,
  p_assignment_type text,
  p_due_date date,
  p_is_extended boolean,
  p_extended_date date
) returns assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row assignments;
begin
  if passcode <> '5555' then
    raise exception 'Invalid passcode';
  end if;

  update assignments
  set subject = p_subject,
      assignment_name = p_assignment_name,
      assignment_type = p_assignment_type,
      due_date = p_due_date,
      is_extended = p_is_extended,
      extended_date = p_extended_date
  where id = p_id
  returning * into updated_row;

  return updated_row;
end;
$$;

create or replace function delete_assignment(
  passcode text,
  p_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if passcode <> '5555' then
    raise exception 'Invalid passcode';
  end if;

  delete from assignments where id = p_id;
end;
$$;

-- Let the app's public (anon) role call these functions. RLS above still
-- blocks it from writing to the table any other way.
grant execute on function verify_passcode(text) to anon, authenticated;
grant execute on function add_assignment(text, text, text, text, date) to anon, authenticated;
grant execute on function update_assignment(text, uuid, text, text, text, date, boolean, date) to anon, authenticated;
grant execute on function delete_assignment(text, uuid) to anon, authenticated;
