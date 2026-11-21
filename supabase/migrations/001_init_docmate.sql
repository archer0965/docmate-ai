-- DocMate AI 初始資料庫結構
-- 請在 Supabase SQL Editor 執行本檔，或用 supabase db push

-- 會員資料（方案與每月額度）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  documents_used integer not null default 0 check (documents_used >= 0),
  questions_used integer not null default 0 check (questions_used >= 0),
  usage_period text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 文件主檔
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

-- 文件文字分段（含頁碼，供問答引用）
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

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- 問答紀錄
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_pages integer[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_document_id_created_at_idx
  on public.chat_messages (document_id, created_at asc);

-- 新使用者自動建立 profile（台北時區月份）
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
  insert into public.profiles (id, email, display_name, usage_period)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    period
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_messages enable row level security;

-- profiles：只能讀自己；不可自行改 plan（需 service role / 伺服器）
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- 使用者不可自行修改 plan / 額度（這些只能由伺服器 service role 更新）
drop policy if exists "profiles_update_display_name" on public.profiles;
create policy "profiles_update_display_name"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and plan = (select p.plan from public.profiles p where p.id = auth.uid())
    and documents_used = (select p.documents_used from public.profiles p where p.id = auth.uid())
    and questions_used = (select p.questions_used from public.profiles p where p.id = auth.uid())
    and usage_period = (select p.usage_period from public.profiles p where p.id = auth.uid())
  );

-- documents
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
  on public.documents for select
  using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own"
  on public.documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own"
  on public.documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own"
  on public.documents for delete
  using (auth.uid() = user_id);

-- chunks
drop policy if exists "chunks_select_own" on public.document_chunks;
create policy "chunks_select_own"
  on public.document_chunks for select
  using (auth.uid() = user_id);

drop policy if exists "chunks_insert_own" on public.document_chunks;
create policy "chunks_insert_own"
  on public.document_chunks for insert
  with check (auth.uid() = user_id);

drop policy if exists "chunks_delete_own" on public.document_chunks;
create policy "chunks_delete_own"
  on public.document_chunks for delete
  using (auth.uid() = user_id);

-- chat
drop policy if exists "chat_select_own" on public.chat_messages;
create policy "chat_select_own"
  on public.chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Storage bucket（若已存在可略過）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS：路徑第一層必須是自己的 user id
drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_update_own" on storage.objects;
create policy "documents_storage_update_own"
  on storage.objects for update
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
