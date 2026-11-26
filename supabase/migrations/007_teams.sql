-- Nova AI Doc：BUSINESS 團隊功能（非破壞性）
-- 擁有者需 BUSINESS；被邀請成員可不升級亦可存取共享文件

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teams_owner_id_idx on public.teams (owner_id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index if not exists team_members_user_id_idx on public.team_members (user_id);
create index if not exists team_members_team_id_idx on public.team_members (team_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token text not null unique,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (team_id, email)
);

create index if not exists team_invites_email_idx
  on public.team_invites (lower(email), status);

-- 文件可共享到一個團隊（null = 僅個人）
alter table public.documents
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists documents_team_id_idx
  on public.documents (team_id)
  where team_id is not null;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- 輔助：目前使用者是否為團隊成員
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.is_team_admin(uuid) from public;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.is_team_admin(uuid) to authenticated;

-- RLS
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member" on public.teams for select using (
  public.is_team_member(id) or owner_id = auth.uid()
);

drop policy if exists "teams_insert_owner" on public.teams;
create policy "teams_insert_owner" on public.teams for insert with check (
  owner_id = auth.uid()
);

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin" on public.teams for update using (
  public.is_team_admin(id)
);

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner" on public.teams for delete using (
  owner_id = auth.uid()
);

drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members for select using (
  public.is_team_member(team_id)
);

drop policy if exists "team_members_insert_admin" on public.team_members;
create policy "team_members_insert_admin" on public.team_members for insert with check (
  public.is_team_admin(team_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = auth.uid()
    )
  )
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.team_invites i
      where i.team_id = team_id
        and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and i.status = 'pending'
        and i.expires_at > now()
    )
  )
);

drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete" on public.team_members for delete using (
  public.is_team_admin(team_id) or user_id = auth.uid()
);

drop policy if exists "team_invites_select" on public.team_invites;
create policy "team_invites_select" on public.team_invites for select using (
  public.is_team_admin(team_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "team_invites_insert" on public.team_invites;
create policy "team_invites_insert" on public.team_invites for insert with check (
  public.is_team_admin(team_id) and invited_by = auth.uid()
);

drop policy if exists "team_invites_update" on public.team_invites;
create policy "team_invites_update" on public.team_invites for update using (
  public.is_team_admin(team_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- 文件：本人或團隊成員可讀
drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_select_own_or_team" on public.documents;
create policy "documents_select_own_or_team" on public.documents for select using (
  auth.uid() = user_id
  or (team_id is not null and public.is_team_member(team_id))
);

-- 更新／刪除仍僅擁有者；共享狀態由擁有者或團隊 admin 透過 API（service）處理亦可
-- 擁有者可更新 team_id
drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents for update using (
  auth.uid() = user_id
) with check (
  auth.uid() = user_id
);

-- chunks：本人或文件所屬團隊成員可讀
drop policy if exists "chunks_select_own" on public.document_chunks;
drop policy if exists "chunks_select_own_or_team" on public.document_chunks;
create policy "chunks_select_own_or_team" on public.document_chunks for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.team_id is not null
      and public.is_team_member(d.team_id)
  )
);

-- 摘要／學習產物：本人或共享團隊成員可讀
drop policy if exists "summaries_select_own" on public.document_summaries;
drop policy if exists "summaries_select_own_or_team" on public.document_summaries;
create policy "summaries_select_own_or_team" on public.document_summaries for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.team_id is not null
      and public.is_team_member(d.team_id)
  )
);

-- 摘要寫入：文件擁有者（unique 為 document_id+type，成員不覆寫）
drop policy if exists "summaries_insert_own" on public.document_summaries;
create policy "summaries_insert_own" on public.document_summaries for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.documents d
    where d.id = document_id and d.user_id = auth.uid()
  )
);

drop policy if exists "study_select_own" on public.study_artifacts;
drop policy if exists "study_select_own_or_team" on public.study_artifacts;
create policy "study_select_own_or_team" on public.study_artifacts for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.team_id is not null
      and public.is_team_member(d.team_id)
  )
);

drop policy if exists "study_insert_own" on public.study_artifacts;
create policy "study_insert_own" on public.study_artifacts for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.documents d
    where d.id = document_id
      and (
        d.user_id = auth.uid()
        or (d.team_id is not null and public.is_team_member(d.team_id))
      )
  )
);

-- Storage：團隊成員可下載已共享文件的 PDF
drop policy if exists "documents_storage_select_own" on storage.objects;
drop policy if exists "documents_storage_select_own_or_team" on storage.objects;
create policy "documents_storage_select_own_or_team" on storage.objects for select
  using (
    bucket_id = 'documents'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or exists (
        select 1 from public.documents d
        where d.storage_path = name
          and d.team_id is not null
          and public.is_team_member(d.team_id)
      )
    )
  );
