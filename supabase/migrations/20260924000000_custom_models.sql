-- Golf Check: картки авто, які склав ШІ для «іншого авто». Пише Edge Function generate (сервісний ключ),
-- користувач читає свої, щоб огляди на таких моделях відкривалися на інших пристроях.

create table if not exists public.custom_models (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  input jsonb not null default '{}'::jsonb,   -- що вписав користувач: марка, модель, рік, двигун, коробка, кузов
  def jsonb not null,                          -- відповідь ШІ (сирий JSON; клієнт нормалізує сам)
  created_at timestamptz not null default now()
);
create index if not exists custom_models_user_idx on public.custom_models(user_id, created_at);
alter table public.custom_models enable row level security;
drop policy if exists "custom_models: own read" on public.custom_models;
create policy "custom_models: own read" on public.custom_models for select using (auth.uid() = user_id);
drop policy if exists "custom_models: own delete" on public.custom_models;
create policy "custom_models: own delete" on public.custom_models for delete using (auth.uid() = user_id);
