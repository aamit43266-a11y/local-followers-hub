-- Local Followers Hub schema
-- Run in Supabase SQL Editor as project owner.
create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 2 and 80),
  username text not null check (username ~ '^[A-Za-z0-9._]{1,30}$'),
  district text not null check (district in ('Deoria','Gorakhpur','Kushinagar','Mau','Ballia','Other')),
  area text not null check (char_length(trim(area)) between 1 and 80),
  category text not null check (category in ('Business','Creator','Personal')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_unique unique (username)
);
create index if not exists profiles_public_search_idx on public.profiles(status, district, category, created_at desc);
alter table public.profiles enable row level security;

-- The admin allowlist cannot be edited by anonymous/authenticated clients.
-- Admin membership must be added manually by the project owner in SQL Editor.
revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;

drop policy if exists "Admins can read own allowlist row" on public.app_admins;
create policy "Admins can read own allowlist row"
on public.app_admins for select to authenticated
using (user_id = (select auth.uid()));

create or replace function public.is_hub_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_hub_admin() from public;
grant execute on function public.is_hub_admin() to anon, authenticated;

-- Anyone can read approved profiles only.
drop policy if exists "Public reads approved profiles" on public.profiles;
create policy "Public reads approved profiles"
on public.profiles for select to anon, authenticated
using (status = 'approved' or public.is_hub_admin());

-- Visitors can submit only pending entries; status is forced by policy.
drop policy if exists "Anyone submits pending profile" on public.profiles;
create policy "Anyone submits pending profile"
on public.profiles for insert to anon, authenticated
with check (
  status = 'pending'
  and char_length(trim(display_name)) between 2 and 80
  and char_length(trim(area)) between 1 and 80
  and username ~ '^[A-Za-z0-9._]{1,30}$'
  and district in ('Deoria','Gorakhpur','Kushinagar','Mau','Ballia','Other')
  and category in ('Business','Creator','Personal')
);

drop policy if exists "Admins update profiles" on public.profiles;
create policy "Admins update profiles"
on public.profiles for update to authenticated
using (public.is_hub_admin())
with check (public.is_hub_admin());

drop policy if exists "Admins delete profiles" on public.profiles;
create policy "Admins delete profiles"
on public.profiles for delete to authenticated
using (public.is_hub_admin());

grant select, insert on public.profiles to anon, authenticated;
grant update, delete on public.profiles to authenticated;

-- Optional updated_at trigger.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- AFTER creating/inviting the admin Auth user, run the separate bootstrap SQL
-- in README.md. Do not expose service_role keys in browser code.
