-- 鎖定 profile 額度欄位：一般使用者不可自行修改 plan / 使用次數
-- （若 001 已套用，請再執行本檔）

drop policy if exists "profiles_update_own_safe" on public.profiles;

-- 僅允許更新顯示名稱（不可動 plan / 額度）
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
