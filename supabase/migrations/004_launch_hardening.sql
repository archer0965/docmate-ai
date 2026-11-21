-- 上線強化：原子額度預扣 + 防止跨文件污染 chunks/chat

create or replace function public.reserve_document_slot(p_user_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_used integer;
begin
  update public.profiles
  set documents_used = documents_used + 1
  where id = p_user_id
    and documents_used < p_limit
  returning documents_used into new_used;

  return new_used; -- null 代表額度不足
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
  update public.profiles
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

-- chunks：只能寫入自己的文件
drop policy if exists "chunks_insert_own" on public.document_chunks;
create policy "chunks_insert_own"
  on public.document_chunks for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

-- chat：只能寫入自己的文件
drop policy if exists "chat_insert_own" on public.chat_messages;
create policy "chat_insert_own"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );
