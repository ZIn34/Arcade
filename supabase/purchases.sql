-- CREXZ Arcade coin purchases. One row per Stripe checkout; a row is "claimed" once its coins are handed out.
-- Row level security is on with no policies, so only the server-side coin shop (service role) can read or write it.
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  session_id text unique not null,
  pack text not null,
  coins integer not null,
  amount_cents integer not null,
  device_id text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
alter table public.purchases enable row level security;
