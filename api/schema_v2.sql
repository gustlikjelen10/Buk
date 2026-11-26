-- Migracja v2: uruchom w Supabase -> SQL Editor (po schema.sql)
alter table public.bets
  add column if not exists pin_odds numeric,
  add column if not exists fair_prob numeric,
  add column if not exists fixture_id text,
  add column if not exists clv_pct numeric;
