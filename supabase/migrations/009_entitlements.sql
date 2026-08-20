-- 009: Entitlements & Billing Scaffold (WP-9).
-- Stripe/Processor wiring is gated on JR decision (Hard Do-Not-Do §2).
-- Schema creates tier and entitlement records with owner-only RLS read policies. Writes are service-role only.

do $$ begin
  create type subscription_tier as enum ('free', 'pro', 'founder');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entitlement_status as enum ('active', 'past_due', 'canceled', 'trialing');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier subscription_tier not null default 'free',
  status entitlement_status not null default 'active',
  processor text, -- 'stripe' or alternative pending JR written approval
  processor_customer_id text,
  processor_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key text not null,
  granted boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists entitlements_user_idx on public.entitlements (user_id);
create unique index if not exists entitlements_user_feature_idx on public.entitlements (user_id, feature_key);

-- RLS: Owner-only select. Writes are service-role only.
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

do $$ begin
  create policy subscriptions_select on public.subscriptions for select to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy entitlements_select on public.entitlements for select to authenticated
    using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;
