-- Nova AI Doc：工作區、多型摘要、考題／閃卡、引用段落、去重雜湊
-- 非破壞性：僅新增欄位／資料表

alter table public.documents
  add column if not exists content_hash text,
  add column if not exists source_kind text not null default 'text'
    check (source_kind in ('text', 'ocr', 'mixed'));

create index if not exists documents_user_content_hash_idx
  on public.documents (user_id, content_hash)
  where content_hash is not null;

-- 多種摘要（一般／詳細／章節／筆記／關鍵字／考試重點）
create table if not exists public.document_summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  summary_type text not null check (summary_type in (
    'general', 'detailed', 'chapters', 'bullets', 'keywords', 'exam'
  )),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, summary_type)
);

create index if not exists document_summaries_document_id_idx
  on public.document_summaries (document_id);

-- 對話工作階段（可綁多份文件）
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '新對話',
  document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_id_idx
  on public.chat_sessions (user_id, updated_at desc);

-- 擴充 chat_messages：可選 session、引用段落
alter table public.chat_messages
  add column if not exists session_id uuid references public.chat_sessions (id) on delete cascade,
  add column if not exists citations jsonb not null default '[]'::jsonb;

alter table public.chat_messages
  alter column document_id drop not null;

-- 學習工具產物
create table if not exists public.study_artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  artifact_type text not null check (artifact_type in (
    'notes', 'concepts', 'mcq', 'true_false', 'qa', 'flashcards', 'mock_exam', 'wrong_book'
  )),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  question_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_artifacts_document_id_idx
  on public.study_artifacts (document_id, created_at desc);

-- RLS
alter table public.document_summaries enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.study_artifacts enable row level security;

drop policy if exists "summaries_select_own" on public.document_summaries;
create policy "summaries_select_own" on public.document_summaries for select using (auth.uid() = user_id);
drop policy if exists "summaries_insert_own" on public.document_summaries;
create policy "summaries_insert_own" on public.document_summaries for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
);
drop policy if exists "summaries_update_own" on public.document_summaries;
create policy "summaries_update_own" on public.document_summaries for update using (auth.uid() = user_id);
drop policy if exists "summaries_delete_own" on public.document_summaries;
create policy "summaries_delete_own" on public.document_summaries for delete using (auth.uid() = user_id);

drop policy if exists "sessions_select_own" on public.chat_sessions;
create policy "sessions_select_own" on public.chat_sessions for select using (auth.uid() = user_id);
drop policy if exists "sessions_insert_own" on public.chat_sessions;
create policy "sessions_insert_own" on public.chat_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "sessions_update_own" on public.chat_sessions;
create policy "sessions_update_own" on public.chat_sessions for update using (auth.uid() = user_id);
drop policy if exists "sessions_delete_own" on public.chat_sessions;
create policy "sessions_delete_own" on public.chat_sessions for delete using (auth.uid() = user_id);

drop policy if exists "study_select_own" on public.study_artifacts;
create policy "study_select_own" on public.study_artifacts for select using (auth.uid() = user_id);
drop policy if exists "study_insert_own" on public.study_artifacts;
create policy "study_insert_own" on public.study_artifacts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid())
);
drop policy if exists "study_update_own" on public.study_artifacts;
create policy "study_update_own" on public.study_artifacts for update using (auth.uid() = user_id);
drop policy if exists "study_delete_own" on public.study_artifacts;
create policy "study_delete_own" on public.study_artifacts for delete using (auth.uid() = user_id);

-- 額度退還（AI 失敗時由 service role 呼叫）
create or replace function public.release_document_slot(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  update public.docmate_profiles
  set documents_used = greatest(documents_used - 1, 0)
  where id = p_user_id
  returning documents_used into new_used;
  return new_used;
end;
$$;

create or replace function public.release_question_slot(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  update public.docmate_profiles
  set questions_used = greatest(questions_used - 1, 0)
  where id = p_user_id
  returning questions_used into new_used;
  return new_used;
end;
$$;

revoke all on function public.release_document_slot(uuid) from public;
revoke all on function public.release_question_slot(uuid) from public;
grant execute on function public.release_document_slot(uuid) to service_role;
grant execute on function public.release_question_slot(uuid) to service_role;
