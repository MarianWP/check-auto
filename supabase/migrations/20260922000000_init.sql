-- Golf Check: профілі, огляди, власні пункти чек-листа, фото до проблем.
-- Виконати у SQL Editor проєкту Supabase або `supabase db push`.

create extension if not exists pgcrypto;

-- ---------- Профілі (створює Edge Function telegram-auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tg_id bigint unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles for select using (auth.uid() = id);

-- ---------- Огляди: лише власні ----------
create table if not exists public.inspections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null default 'golf5',
  name text not null default '',
  price integer not null default 0,
  cfg jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  stage integer not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
create index if not exists inspections_user_idx on public.inspections(user_id);
alter table public.inspections enable row level security;
drop policy if exists "inspections: own" on public.inspections;
create policy "inspections: own" on public.inspections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Власні пункти чек-листа (адмінка) ----------
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  model text,                          -- null = для всіх моделей
  stage text not null,                 -- id етапу з src/data/checklist.js
  title text not null,
  how text not null default '',
  why text not null default '',
  sev text not null default 'major' check (sev in ('crit', 'major', 'minor')),
  cost_lo integer,
  cost_hi integer,
  tags text[] not null default '{}',
  only_tags text[] not null default '{}',
  sort integer not null default 100,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.checklist_items enable row level security;
drop policy if exists "items: read enabled" on public.checklist_items;
create policy "items: read enabled" on public.checklist_items for select using (enabled or public.is_admin());
drop policy if exists "items: admin write" on public.checklist_items;
create policy "items: admin write" on public.checklist_items for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Фото до проблем і пунктів (адмінка) ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  model text,                          -- null = спільне (двигун/коробка з бібліотеки)
  kind text not null check (kind in ('engine', 'gearbox', 'common', 'item')),
  target text not null,                -- id двигуна/коробки/пункту або модель для common
  idx integer not null default 0,      -- індекс проблеми у списку issues
  path text not null,                  -- шлях у бакеті photos
  caption text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.photos enable row level security;
drop policy if exists "photos: read all" on public.photos;
create policy "photos: read all" on public.photos for select using (true);
drop policy if exists "photos: admin write" on public.photos;
create policy "photos: admin write" on public.photos for all using (public.is_admin()) with check (public.is_admin());

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists items_touch on public.checklist_items;
create trigger items_touch before update on public.checklist_items for each row execute function public.touch_updated_at();

-- ---------- Сховище фото: публічне читання, запис лише адмінам ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "photos bucket: public read" on storage.objects;
create policy "photos bucket: public read" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "photos bucket: admin write" on storage.objects;
create policy "photos bucket: admin write" on storage.objects for all
  using (bucket_id = 'photos' and public.is_admin()) with check (bucket_id = 'photos' and public.is_admin());

-- Зробити себе адміном після першого входу (tg_id — числовий id у Telegram):
-- update public.profiles set role = 'admin' where tg_id = 123456789;
