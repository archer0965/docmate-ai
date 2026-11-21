-- 訂閱與測試金流訂單（付款狀態只由伺服器 service role 更新）

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

-- 新使用者同時建立 subscription（free）
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

  insert into public.subscriptions (user_id, plan, status, provider)
  values (new.id, 'free', 'active', 'test')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 既有使用者補 subscription
insert into public.subscriptions (user_id, plan, status, provider)
select p.id, p.plan, 'active', 'test'
from public.profiles p
on conflict (user_id) do nothing;

alter table public.subscriptions enable row level security;
alter table public.payment_orders enable row level security;

-- 使用者只能讀自己的訂閱／訂單，不可自行改狀態或方案
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "payment_orders_select_own" on public.payment_orders;
create policy "payment_orders_select_own"
  on public.payment_orders for select
  using (auth.uid() = user_id);

-- 不開放 insert/update/delete 給 anon/authenticated（全部走 service role）
