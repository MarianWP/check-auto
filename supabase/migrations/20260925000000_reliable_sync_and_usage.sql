-- Deploy before the matching client. Old clients must reload after deployment:
-- writes now go through an RPC with an expected revision.
-- Safe to run again: every step checks what already exists.
alter table public.inspections add column if not exists revision bigint not null default 1;
alter table public.inspections add column if not exists deleted_at timestamptz;
alter table public.inspections add column if not exists checklist_snapshot jsonb;
alter table public.inspections add column if not exists price_snapshot jsonb;
alter table public.inspections add column if not exists model_snapshot jsonb;
alter table public.inspections add column if not exists report_version integer not null default 1;
drop policy if exists "inspections: own" on public.inspections;
drop policy if exists "inspections: own read" on public.inspections;
create policy "inspections: own read" on public.inspections for select using (auth.uid() = user_id);

create or replace function public.sync_inspection(p_id text, p_base_revision bigint, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  existing public.inspections%rowtype;
  result public.inspections%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_id is null or length(p_id) not between 1 and 40 or p_base_revision is null or p_base_revision < 0 then raise exception 'Invalid record'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id, 0));
  select * into existing from public.inspections where id = p_id;
  if found and existing.user_id <> owner_id then raise exception 'Record belongs to another account' using errcode = '42501'; end if;
  if existing.id is not null and (existing.revision <> p_base_revision or existing.deleted_at is not null) then
    return jsonb_build_object('conflict', true, 'row', to_jsonb(existing));
  end if;
  if existing.id is null and p_base_revision <> 0 then raise exception 'Missing base revision'; end if;
  if p_record is not null and (jsonb_typeof(p_record) <> 'object' or jsonb_typeof(p_record->'cfg') is distinct from 'object'
      or jsonb_typeof(p_record->'answers') is distinct from 'object' or octet_length(p_record::text) > 2000000) then
    raise exception 'Invalid payload';
  end if;
  if p_record is null then
    if existing.id is null then
      insert into public.inspections(id, user_id, cfg, deleted_at) values(p_id, owner_id, '{}'::jsonb, now()) returning * into result;
    else
      update public.inspections set deleted_at = now(), revision = revision + 1, synced_at = now()
        where id = p_id returning * into result;
    end if;
  else
    insert into public.inspections(id, user_id, model, name, price, cfg, answers, stage, done, created_at, updated_at,
      checklist_snapshot, price_snapshot, model_snapshot, report_version, revision)
    values(p_id, owner_id, coalesce(p_record->>'model', 'golf5'), left(coalesce(p_record->>'name', ''), 60),
      greatest(0, (p_record->>'price')::integer), p_record->'cfg', p_record->'answers', greatest(0, (p_record->>'stage')::integer),
      coalesce((p_record->>'done')::boolean, false), (p_record->>'created_at')::timestamptz, (p_record->>'updated_at')::timestamptz,
      p_record->'checklist_snapshot', p_record->'price_snapshot', p_record->'model_snapshot', 1, coalesce(existing.revision, 0) + 1)
    on conflict(id) do update set model = excluded.model, name = excluded.name, price = excluded.price,
      cfg = excluded.cfg, answers = excluded.answers, stage = excluded.stage, done = excluded.done,
      updated_at = excluded.updated_at, checklist_snapshot = excluded.checklist_snapshot,
      price_snapshot = excluded.price_snapshot, model_snapshot = excluded.model_snapshot, report_version = excluded.report_version,
      revision = excluded.revision, synced_at = now()
    returning * into result;
  end if;
  return jsonb_build_object('conflict', false, 'row', to_jsonb(result));
end $$;
revoke all on function public.sync_inspection(text, bigint, jsonb) from public, anon;
grant execute on function public.sync_inspection(text, bigint, jsonb) to authenticated;

-- Quotas count reserved attempts, including provider failures and cancellation.
-- Deleting chat history never refunds a reservation. Only Edge Functions may reserve.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('assistant', 'generate')),
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;
create index if not exists ai_usage_window_idx on public.ai_usage(user_id, kind, created_at);
-- Carry over the last day of usage only once: a repeated run must not double anyone's count.
do $$ begin
  if not exists (select 1 from public.ai_usage) then
    insert into public.ai_usage(user_id, kind, created_at)
      select user_id, 'assistant', created_at from public.assistant_messages where role = 'user' and created_at > now() - interval '24 hours';
    insert into public.ai_usage(user_id, kind, created_at)
      select user_id, 'generate', created_at from public.custom_models where created_at > now() - interval '24 hours';
  end if;
end $$;

create or replace function public.reserve_ai_usage(p_user uuid, p_kind text, p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  if p_user is null or p_kind not in ('assistant', 'generate') or p_limit is null or p_limit < 1 or p_limit > 10000 then raise exception 'Invalid quota'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text || ':' || p_kind, 0));
  select count(*) into used from public.ai_usage where user_id = p_user and kind = p_kind and created_at > now() - interval '24 hours';
  if used >= p_limit then return jsonb_build_object('allowed', false, 'remaining', 0); end if;
  insert into public.ai_usage(user_id, kind) values(p_user, p_kind);
  return jsonb_build_object('allowed', true, 'remaining', p_limit - used - 1);
end $$;
revoke all on function public.reserve_ai_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, integer) to service_role;
