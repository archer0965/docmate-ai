-- Atomic quota release after AI / processing failure (docmate_profiles)

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
  set documents_used = documents_used - 1
  where id = p_user_id
    and documents_used > 0
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
  set questions_used = questions_used - 1
  where id = p_user_id
    and questions_used > 0
  returning questions_used into new_used;

  return new_used;
end;
$$;

revoke all on function public.release_document_slot(uuid) from public;
revoke all on function public.release_question_slot(uuid) from public;
grant execute on function public.release_document_slot(uuid) to service_role;
grant execute on function public.release_question_slot(uuid) to service_role;
