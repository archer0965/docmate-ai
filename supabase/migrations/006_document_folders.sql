-- Optional folder label for documents (nullable; empty = uncategorized)
alter table public.documents
  add column if not exists folder text;

create index if not exists documents_user_id_folder_idx
  on public.documents (user_id, folder);

comment on column public.documents.folder is
  'Optional user folder label; null means uncategorized. Isolation remains via user_id + RLS.';

-- Allow Word uploads in Storage bucket (alongside PDF)
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
]
where id = 'documents';
