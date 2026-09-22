-- Golf Check: історія чату з помічником. Пише лише Edge Function assistant (сервісний ключ),
-- користувач читає і видаляє свої повідомлення.

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inspection_id text,                  -- null = розмова без прив'язки до огляду
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_user_idx on public.assistant_messages(user_id, created_at);
alter table public.assistant_messages enable row level security;
drop policy if exists "assistant: own read" on public.assistant_messages;
create policy "assistant: own read" on public.assistant_messages for select using (auth.uid() = user_id);
drop policy if exists "assistant: own delete" on public.assistant_messages;
create policy "assistant: own delete" on public.assistant_messages for delete using (auth.uid() = user_id);
