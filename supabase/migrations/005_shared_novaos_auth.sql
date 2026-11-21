-- DocMate shares NovaOS Supabase Auth (same auth.users).
-- NovaOS already owns public.profiles — use docmate_profiles for AI Doc quotas.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Billing tables first (handle_new_user inserts into subscriptions)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status text not null default 'active'
    check (status in ('active', 'canceled', 'past_due')),
  provider text not null default 'test',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_plan text not null check (target_plan in ('pro', 'business')),
  amount_twd integer not null check (amount_twd > 0),
  currency text not null default 'TWD',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'canceled')),
  provider text not null default 'test',
  provider_ref text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_id_created_at_idx
  on public.payment_orders (user_id, created_at desc);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists payment_orders_set_updated_at on public.payment_orders;
create trigger payment_orders_set_updated_at
  before update on public.payment_orders
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.payment_orders enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "payment_orders_select_own" on public.payment_orders;
create policy "payment_orders_select_own"
  on public.payment_orders for select
  using (auth.uid() = user_id);

create table if not exists public.docmate_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  documents_used integer not null default 0 check (documents_used >= 0),
  questions_used integer not null default 0 check (questions_used >= 0),
  usage_period text not null default to_char(timezone('Asia/Taipei', now()), 'YYYY-MM'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists docmate_profiles_usage_period_idx
  on public.docmate_profiles (usage_period);

alter table public.docmate_profiles enable row level security;

drop policy if exists "docmate_profiles_select_own" on public.docmate_profiles;
create policy "docmate_profiles_select_own"
  on public.docmate_profiles for select
  using (auth.uid() = id);

drop policy if exists "docmate_profiles_update_display_name" on public.docmate_profiles;
create policy "docmate_profiles_update_display_name"
  on public.docmate_profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from public.docmate_profiles p where p.id = auth.uid())
    and documents_used = (select p.documents_used from public.docmate_profiles p where p.id = auth.uid())
    and questions_used = (select p.questions_used from public.docmate_profiles p where p.id = auth.uid())
    and usage_period = (select p.usage_period from public.docmate_profiles p where p.id = auth.uid())
  );

-- Keep NovaOS shop profile + create DocMate quota profile for every new auth user.
-- Registration does not start NovaOS paid-module trial (trial starts on module activation).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  period text;
begin
  period := to_char(timezone('Asia/Taipei', now()), 'YYYY-MM');

  insert into public.profiles (id, shop_name, trial_ends_at, signup_early_bird, active_modules)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'shop_name', ''),
    null,
    false,
    array[]::text[]
  )
  on conflict (id) do nothing;

  insert into public.docmate_profiles (id, email, display_name, usage_period)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    period
  )
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status, provider)
  values (new.id, 'free', 'active', 'test')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Backfill DocMate profiles for existing NovaOS auth users
insert into public.docmate_profiles (id, email, display_name, usage_period)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, 'user'), '@', 1)),
  to_char(timezone('Asia/Taipei', now()), 'YYYY-MM')
from auth.users u
on conflict (id) do nothing;

insert into public.subscriptions (user_id, plan, status, provider)
select u.id, 'free', 'active', 'test'
from auth.users u
on conflict (user_id) do nothing;

-- DocMate document tables (safe if already applied from 001)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  file_name text not null,
  storage_path text not null,
  file_size integer not null check (file_size > 0),
  page_count integer,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error_message text,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer not null check (page_number >= 1),
  content text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_pages integer[] not null default '{}',
  created_at timestamptz not null default now()
);

drop trigger if exists docmate_profiles_set_updated_at on public.docmate_profiles;
create trigger docmate_profiles_set_updated_at
  before update on public.docmate_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents for select using (auth.uid() = user_id);
drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents for insert with check (auth.uid() = user_id);
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents for delete using (auth.uid() = user_id);

drop policy if exists "chunks_select_own" on public.document_chunks;
create policy "chunks_select_own" on public.document_chunks for select using (auth.uid() = user_id);
drop policy if exists "chunks_insert_own" on public.document_chunks;
create policy "chunks_insert_own" on public.document_chunks for insert with check (auth.uid() = user_id);
drop policy if exists "chunks_delete_own" on public.document_chunks;
create policy "chunks_delete_own" on public.document_chunks for delete using (auth.uid() = user_id);

drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own" on public.chat_messages for select using (auth.uid() = user_id);
drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own" on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "documents_storage_update_own" on storage.objects;
create policy "documents_storage_update_own" on storage.objects for update
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own" on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- Quota RPCs target docmate_profiles (not NovaOS profiles)
create or replace function public.reserve_document_slot(p_user_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  update public.docmate_profiles
  set documents_used = documents_used + 1
  where id = p_user_id
    and documents_used < p_limit
  returning documents_used into new_used;

  return new_used;
end;
$$;

create or replace function public.reserve_question_slot(p_user_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  update public.docmate_profiles
  set questions_used = questions_used + 1
  where id = p_user_id
    and questions_used < p_limit
  returning questions_used into new_used;

  return new_used;
end;
$$;

revoke all on function public.reserve_document_slot(uuid, integer) from public;
revoke all on function public.reserve_question_slot(uuid, integer) from public;
grant execute on function public.reserve_document_slot(uuid, integer) to service_role;
grant execute on function public.reserve_question_slot(uuid, integer) to service_role;

-- Billing helpers from 003/004 — rewrite to docmate_profiles if present later
create or replace function public.apply_paid_plan(p_user_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.docmate_profiles
  set plan = p_plan
  where id = p_user_id;
end;
$$;
